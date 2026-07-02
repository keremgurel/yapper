import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { FEEDBACK_CREDITS, type FeedbackTier } from "@/lib/db/constants";
import {
  deductCredits,
  getBalance,
  InsufficientCreditsError,
  refundCredits,
} from "@/lib/db/credits";
import { submissions } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { runAudioFeedback } from "@/lib/feedback/audio";
import type { Coaching } from "@/lib/feedback/coach";
import { computeMetrics, type DeliveryMetrics } from "@/lib/feedback/metrics";
import { transcribeForFeedback } from "@/lib/feedback/transcribe";
import { coachOnCamera } from "@/lib/feedback/video";

export const runtime = "nodejs";
export const maxDuration = 300;

const TIERS: FeedbackTier[] = ["audio", "video", "full"];

interface FeedbackResult {
  metrics?: DeliveryMetrics;
  coaching: Coaching;
  words?: unknown;
}

/**
 * Get AI feedback on a recording. Auth required (the credit action).
 * - audio: POST body = 16 kHz WAV → Deepgram meters + LLM coaching.
 * - video: ?fileUri=… (video already uploaded to Gemini) → on-camera coaching.
 * - full:  ?fileUri=… + WAV body → Deepgram meters + Gemini video coaching.
 *
 * Create submission → deduct → run → store; refund + mark failed on any error,
 * so a failure never costs a credit.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const tier = (params.get("tier") ?? "audio") as FeedbackTier;
  if (!TIERS.includes(tier)) {
    return Response.json({ error: "bad_tier" }, { status: 400 });
  }
  const cost = FEEDBACK_CREDITS[tier];
  const fileUri = params.get("fileUri") ?? undefined;
  const mimeType = params.get("mimeType") ?? "video/webm";
  if ((tier === "video" || tier === "full") && !fileUri) {
    return Response.json({ error: "missing_file" }, { status: 400 });
  }

  // Read the audio body up front (audio + full need it).
  const audio = tier === "video" ? new ArrayBuffer(0) : await req.arrayBuffer();
  if ((tier === "audio" || tier === "full") && audio.byteLength === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  await ensureUser(userId);

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

  try {
    await deductCredits(userId, cost, { submissionId: submission.id });
  } catch (e) {
    await db.delete(submissions).where(eq(submissions.id, submission.id));
    if (e instanceof InsufficientCreditsError) {
      return Response.json({ error: "insufficient_credits" }, { status: 402 });
    }
    throw e;
  }

  try {
    const result = await runTier(tier, audio, fileUri, mimeType);
    await db
      .update(submissions)
      .set({
        status: "complete",
        durationSec: result.metrics?.durationSec ?? null,
        transcript: result.words ?? null,
        feedback: { metrics: result.metrics, coaching: result.coaching },
        scores: { delivery: result.coaching.score },
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submission.id));

    const balance = await getBalance(userId);
    return Response.json({
      submissionId: submission.id,
      balance,
      metrics: result.metrics,
      coaching: result.coaching,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "feedback_failed";
    let balance: number | undefined;
    try {
      balance = await refundCredits(userId, cost, submission.id);
    } catch {
      // reconcile sweep retries the refund
    }
    try {
      await db
        .update(submissions)
        .set({ status: "failed", error: detail, updatedAt: new Date() })
        .where(eq(submissions.id, submission.id));
    } catch {
      // reconcile sweep fails the stranded submission
    }
    return Response.json(
      { error: "feedback_failed", detail, balance },
      { status: 502 },
    );
  }
}

async function runTier(
  tier: FeedbackTier,
  audio: ArrayBuffer,
  fileUri: string | undefined,
  mimeType: string,
): Promise<FeedbackResult> {
  if (tier === "audio") {
    const r = await runAudioFeedback(audio);
    return { metrics: r.metrics, coaching: r.coaching, words: r.words };
  }
  // video + full: Gemini analyzes the uploaded clip (native video + audio).
  const coaching = await coachOnCamera(fileUri as string, mimeType);
  if (tier === "video") return { coaching };
  // full: add precise deterministic meters from Deepgram on the audio.
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { coaching }; // no transcription provider → video-only result
  const words = await transcribeForFeedback(audio, key);
  const metrics = words.length ? computeMetrics(words) : undefined;
  return { metrics, coaching, words };
}
