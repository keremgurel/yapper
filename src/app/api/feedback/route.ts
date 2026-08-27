import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import {
  FEEDBACK_CREDITS,
  MAX_SERVER_PROCESSED_VIDEO_BYTES,
  type FeedbackTier,
} from "@/lib/db/constants";
import { getStorageQuota } from "@/lib/db/billing";
import {
  deductWithinTx,
  getBalance,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import { submissions } from "@/lib/db/schema";
import {
  activateObjectWithinTx,
  protectPendingObject,
} from "@/lib/db/r2-lifecycle";
import { ensureUser } from "@/lib/db/users";
import {
  countMediaOnceWithinTx,
  StorageQuotaError,
} from "@/lib/db/storage-accounting";
import { runAudioFeedback } from "@/lib/feedback/audio";
import type { Coaching } from "@/lib/feedback/coach";
import { uploadFileToGemini } from "@/lib/feedback/gemini";
import { computeMetrics, type DeliveryMetrics } from "@/lib/feedback/metrics";
import { transcribeForFeedback } from "@/lib/feedback/transcribe";
import { coachOnCamera } from "@/lib/feedback/video";
import {
  createFeedbackWorkflow,
  feedbackFailureStatus,
  type FeedbackWorkflow,
  remainingFeedbackMs,
} from "@/lib/feedback/workflow";
import { getObjectFile, ownsKey } from "@/lib/r2";
import { canUsePremium } from "@/lib/billing/gate";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import {
  readBoundedBody,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import { TemporaryFileTooLargeError } from "@/lib/http/bounded-temp-file";

export const runtime = "nodejs";
export const maxDuration = 300;

const TIERS: FeedbackTier[] = ["audio", "video", "full"];
const MAX_AUDIO_BYTES = 4_000_000;
const MAX_MEDIA_KEY_LENGTH = 512;
const VIDEO_MEDIA_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

interface FeedbackResult {
  metrics?: DeliveryMetrics;
  coaching: Coaching;
  words?: unknown;
  mediaBytes?: number;
}

/**
 * Get AI feedback on a recording. Auth required (the credit action).
 * - audio: POST body = 16 kHz WAV → Deepgram meters + LLM coaching.
 * - video: ?mediaKey=… (caller-owned R2 clip) → on-camera coaching.
 * - full:  ?mediaKey=… + WAV body → Deepgram meters + Gemini video coaching.
 *
 * Run the work first, then charge and store the result in one transaction, so a
 * crash before commit leaves the user uncharged (we absorb the compute) rather
 * than charged-without-result. No refund path, no reconcile sweep.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const workflow = createFeedbackWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const params = new URL(req.url).searchParams;
  const tier = (params.get("tier") ?? "audio") as FeedbackTier;
  if (!TIERS.includes(tier)) {
    return Response.json({ error: "bad_tier" }, { status: 400 });
  }
  const cost = FEEDBACK_CREDITS[tier];
  const rawKey = params.get("mediaKey") ?? undefined;
  // Video/full read the clip from the caller's own R2 prefix.
  const mediaKey =
    rawKey && rawKey.length <= MAX_MEDIA_KEY_LENGTH && ownsKey(userId, rawKey)
      ? rawKey
      : undefined;
  const rawMimeType = params.get("mimeType") ?? "video/webm";
  const mimeType = rawMimeType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  if ((tier === "video" || tier === "full") && !mediaKey) {
    return Response.json({ error: "missing_file" }, { status: 400 });
  }
  if (
    (tier === "video" || tier === "full") &&
    (rawMimeType.length > 100 || !VIDEO_MEDIA_TYPES.has(mimeType))
  ) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  // Read the audio body up front (audio + full need it).
  let audio = new ArrayBuffer(0);
  if (tier !== "video") {
    try {
      const body = await readBoundedBody(req, {
        maxBytes: MAX_AUDIO_BYTES,
        allowedMediaTypes: ["audio/wav"],
        requireContentType: true,
      });
      audio = body.bytes.buffer;
    } catch (error) {
      const response = requestBodyErrorResponse(error);
      if (response) return response;
      throw error;
    }
  }
  if ((tier === "audio" || tier === "full") && audio.byteLength === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }
  // Fast reject before spending compute; the debit at the end re-checks the
  // balance atomically, so this is only a courtesy early-out.
  if ((await getBalance(userId)) < cost) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }
  if (
    mediaKey &&
    !(await protectPendingObject(
      userId,
      mediaKey,
      "recording",
      new Date(Date.now() + 10 * 60 * 1_000),
    ))
  ) {
    return Response.json({ error: "media_unavailable" }, { status: 409 });
  }
  const providerConfigured =
    tier === "audio"
      ? !!process.env.SURPLUS_API_KEY && !!process.env.DEEPGRAM_API_KEY
      : !!process.env.GEMINI_API_KEY;
  if (!providerConfigured) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const spendLimited = await guardProviderSpend(req, userId, "feedback");
  if (spendLimited) return spendLimited;

  try {
    remainingFeedbackMs(workflow);
  } catch (error) {
    return Response.json(
      { error: "feedback_failed", detail: "feedback_deadline_expired" },
      { status: feedbackFailureStatus(error, workflow) },
    );
  }

  const db = getDb();
  const [submission] = await db
    .insert(submissions)
    .values({
      userId,
      kind: tier === "audio" ? "audio" : "video",
      status: "processing",
      creditsCost: cost,
    })
    .returning({ id: submissions.id });

  let result: FeedbackResult;
  try {
    result = await runTier(tier, audio, mediaKey, mimeType, workflow);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "feedback_failed";
    await markSubmissionFailed(db, submission.id, userId, detail);
    const status =
      e instanceof TemporaryFileTooLargeError
        ? 413
        : feedbackFailureStatus(e, workflow);
    return Response.json({ error: "feedback_failed", detail }, { status });
  }

  try {
    // Do not charge/store a result if the request disappeared or exhausted the
    // route budget in the race immediately after the provider resolved.
    remainingFeedbackMs(workflow);
    const quotaBytes = await getStorageQuota(userId);
    // Charge and mark complete in one transaction: a crash before commit rolls
    // back the debit, result, and storage counter together.
    const balance = await db.transaction(async (tx) => {
      if (mediaKey && result.mediaBytes) {
        // All storage registration paths acquire the per-object advisory lock
        // before the user row. Keep this ordering ahead of the credit debit to
        // prevent an advisory-lock ↔ user-row deadlock.
        await activateObjectWithinTx(
          tx,
          userId,
          mediaKey,
          result.mediaBytes,
          "recording",
        );
        await countMediaOnceWithinTx(
          tx,
          userId,
          mediaKey,
          result.mediaBytes,
          submission.id,
          quotaBytes,
        );
      }
      const bal = await deductWithinTx(tx, userId, cost, {
        submissionId: submission.id,
      });
      const completed = await tx
        .update(submissions)
        .set({
          status: "complete",
          durationSec: result.metrics?.durationSec ?? null,
          transcript: result.words ?? null,
          feedback: { metrics: result.metrics, coaching: result.coaching },
          scores: { delivery: result.coaching.score },
          mediaKey: mediaKey ?? null,
          mediaBytes: result.mediaBytes ?? 0,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(submissions.id, submission.id),
            eq(submissions.userId, userId),
            eq(submissions.status, "processing"),
          ),
        )
        .returning({ id: submissions.id });
      if (completed.length === 0) throw new Error("submission_not_processing");
      return bal;
    });

    return Response.json({
      submissionId: submission.id,
      balance,
      metrics: result.metrics,
      coaching: result.coaching,
    });
  } catch (e) {
    // The completion transaction rolled back, so no debit, result, or storage
    // update committed. This route did not create the caller-supplied R2 object
    // and must never delete it on a processing failure.
    const insufficient = e instanceof InsufficientCreditsError;
    const storageFull = e instanceof StorageQuotaError;
    const detail = insufficient
      ? "insufficient_credits"
      : storageFull
        ? "storage_full"
        : e instanceof Error
          ? e.message
          : "feedback_failed";
    await markSubmissionFailed(db, submission.id, userId, detail);
    return insufficient
      ? Response.json({ error: "insufficient_credits" }, { status: 402 })
      : storageFull
        ? Response.json({ error: "storage_full" }, { status: 402 })
        : Response.json(
            { error: "feedback_failed", detail },
            { status: feedbackFailureStatus(e, workflow) },
          );
  }
}

async function markSubmissionFailed(
  db: ReturnType<typeof getDb>,
  submissionId: string,
  userId: string,
  detail: string,
): Promise<void> {
  await db
    .update(submissions)
    .set({ status: "failed", error: detail, updatedAt: new Date() })
    .where(
      and(
        eq(submissions.id, submissionId),
        eq(submissions.userId, userId),
        eq(submissions.status, "processing"),
      ),
    )
    .catch(() => {
      // Best effort: a stranded processing row is cosmetic and never charged.
    });
}

async function runTier(
  tier: FeedbackTier,
  audio: ArrayBuffer,
  mediaKey: string | undefined,
  mimeType: string,
  workflow: FeedbackWorkflow,
): Promise<FeedbackResult> {
  if (tier === "audio") {
    const r = await runAudioFeedback(audio, workflow);
    return { metrics: r.metrics, coaching: r.coaching, words: r.words };
  }
  // video + full: pull the clip from R2 (server-side, no browser CORS), push it
  // to Gemini, and coach on the native video + audio.
  const file = await getObjectFile(mediaKey as string, {
    maxBytes: MAX_SERVER_PROCESSED_VIDEO_BYTES,
    signal: workflow.signal,
  });
  const mediaBytes = file.byteLength;
  let coaching: Coaching;
  try {
    const uri = await uploadFileToGemini(
      file.filePath,
      file.byteLength,
      mimeType,
      workflow,
    );
    remainingFeedbackMs(workflow);
    coaching = await coachOnCamera(uri, mimeType, workflow);
    remainingFeedbackMs(workflow);
  } finally {
    await file.cleanup().catch(() => undefined);
  }
  if (tier === "video") return { coaching, mediaBytes };
  // full: add precise deterministic meters from Deepgram on the audio.
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { coaching, mediaBytes };
  const words = await transcribeForFeedback(
    audio,
    key,
    workflow.signal,
    remainingFeedbackMs(workflow, 60_000),
  );
  remainingFeedbackMs(workflow);
  const metrics = words.length ? computeMetrics(words) : undefined;
  return { metrics, coaching, words, mediaBytes };
}
