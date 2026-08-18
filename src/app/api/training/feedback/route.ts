import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { TRAINING_FEEDBACK_CREDITS } from "@/lib/db/constants";
import {
  deductWithinTx,
  getBalance,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import { submissions } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import { computeMetrics, type FeedbackWord } from "@/lib/feedback/metrics";
import { transcribeForFeedback } from "@/lib/feedback/transcribe";
import {
  createFeedbackWorkflow,
  feedbackFailureStatus,
  remainingFeedbackMs,
} from "@/lib/feedback/workflow";
import {
  readBoundedBody,
  requestBodyErrorResponse,
} from "@/lib/http/bounded-body";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import { PRACTICE_GOALS } from "@/data/training-onboarding";
import { runTrainingCoaching } from "@/lib/training-feedback/coach";
import type {
  TrainingContext,
  TrainingFeedbackRecord,
  TrainingFeedbackResponse,
} from "@/lib/training-feedback/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// One cap on the whole multipart body (audio plus context). Matches the other
// audio ingress routes so the client's chunking rules stay uniform.
const MAX_BODY_BYTES = 4_000_000;
const MAX_PROMPT_CHARS = 2_000;
const MAX_DRILL_TITLE_CHARS = 120;
const MAX_TARGET_SECONDS = 600;
const MAX_TITLE_CHARS = 120;
const DRILL_SLUG_PATTERN = /^[a-z0-9-]{1,64}$/;
const KNOWN_GOAL_IDS = new Set(PRACTICE_GOALS.map((goal) => goal.id));
// A transcript this short cannot be scored on five dimensions; reject before
// an LLM call or a credit is spent.
const MIN_TRANSCRIPT_WORDS = 8;
// Keep in sync with the allowlist in src/app/api/transcribe/route.ts; here it
// applies to the audio part's declared type inside the multipart body.
const AUDIO_MEDIA_TYPES = new Set([
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "application/octet-stream",
]);

/**
 * Get coached AI feedback on one training rep. Auth required (the credit
 * action). Pipeline: transcribe (Deepgram) -> deterministic metrics -> scoring
 * shot -> coaching shot -> charge and store in one transaction.
 *
 * Ingress is multipart/form-data with an `audio` file part and a `context`
 * JSON part, rather than raw audio plus query or header params: the prompt
 * text can run to 2000 characters, which is hostile to URLs and headers, and
 * multipart keeps the audio bytes and their context in one atomically-read
 * body. The whole body still goes through the bounded reader first, so the
 * platform multipart parser only ever sees capped, fully-buffered bytes.
 *
 * Run the work first, then charge and store the result in one transaction, so
 * a crash before commit leaves the user uncharged (we absorb the compute)
 * rather than charged-without-result. Same deliberate protocol as
 * /api/feedback: no refund path, no reconcile sweep.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const workflow = createFeedbackWorkflow(req.signal);
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  let audio: ArrayBuffer;
  let context: TrainingContext;
  try {
    const { bytes } = await readBoundedBody(req, {
      maxBytes: MAX_BODY_BYTES,
      allowedMediaTypes: ["multipart/form-data"],
      requireContentType: true,
    });
    const parsed = await parseTrainingBody(
      bytes,
      req.headers.get("content-type") ?? "",
    );
    if (parsed instanceof Response) return parsed;
    audio = parsed.audio;
    context = parsed.context;
  } catch (error) {
    const response = requestBodyErrorResponse(error);
    if (response) return response;
    throw error;
  }
  if (audio.byteLength === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  await ensureUser(userId);
  // Training feedback is metered by credits alone, with no separate
  // subscription gate. The rest of the AI surface calls canUsePremium first,
  // but doing that here would make the welcome grant unspendable: a brand new
  // account has 3 credits and no subscription, so the very rep the onboarding
  // promises would be free would come back as not_entitled. Credits are the
  // paywall here. The only ways to hold one are the one-time welcome grant,
  // a subscription, or a top-up pack (itself subscriber-only), so nobody gets
  // a second free rep out of this.
  //
  // Fast reject before spending compute; the debit at the end re-checks the
  // balance atomically, so this is only a courtesy early-out.
  if ((await getBalance(userId)) < TRAINING_FEEDBACK_CREDITS) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  if (!deepgramKey || !process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "training-feedback",
  );
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
      kind: "audio",
      surface: "training",
      status: "processing",
      // Recorded as zero until the debit actually commits. A row that fails
      // partway is never charged, so claiming a cost on it would overstate
      // what the user spent to anything that later sums this column.
      creditsCost: 0,
      context,
      title: context.prompt.slice(0, MAX_TITLE_CHARS),
    })
    .returning({ id: submissions.id });

  let words: FeedbackWord[];
  try {
    words = await transcribeForFeedback(
      audio,
      deepgramKey,
      workflow.signal,
      remainingFeedbackMs(workflow, 60_000),
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : "feedback_failed";
    await markSubmissionFailed(db, submission.id, userId, detail);
    return Response.json(
      { error: "feedback_failed", detail },
      { status: feedbackFailureStatus(e, workflow) },
    );
  }
  if (words.length < MIN_TRANSCRIPT_WORDS) {
    await markSubmissionFailed(db, submission.id, userId, "too_short");
    return Response.json({ error: "too_short" }, { status: 422 });
  }

  const metrics = computeMetrics(words);
  let record: TrainingFeedbackRecord;
  try {
    remainingFeedbackMs(workflow);
    const coaching = await runTrainingCoaching(
      words,
      metrics,
      context,
      workflow,
    );
    record = { metrics, coaching, context };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "feedback_failed";
    await markSubmissionFailed(db, submission.id, userId, detail);
    return Response.json(
      { error: "feedback_failed", detail },
      { status: feedbackFailureStatus(e, workflow) },
    );
  }

  const transcript = words.map((w) => ({
    text: w.text,
    start: w.start,
    end: w.end,
  }));
  try {
    // Do not charge/store a result if the request disappeared or exhausted the
    // route budget in the race immediately after the provider resolved.
    remainingFeedbackMs(workflow);
    // Charge and mark complete in one transaction: a crash before commit rolls
    // back the debit and the result together.
    const balance = await db.transaction(async (tx) => {
      const bal = await deductWithinTx(tx, userId, TRAINING_FEEDBACK_CREDITS, {
        submissionId: submission.id,
      });
      const completed = await tx
        .update(submissions)
        .set({
          status: "complete",
          creditsCost: TRAINING_FEEDBACK_CREDITS,
          durationSec: record.metrics.durationSec,
          transcript,
          feedback: record,
          scores: record.coaching.scores,
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

    const response: TrainingFeedbackResponse = {
      submissionId: submission.id,
      balance,
      metrics: record.metrics,
      coaching: record.coaching,
      context: record.context,
      transcript,
    };
    return Response.json(response);
  } catch (e) {
    // The completion transaction rolled back, so no debit or result committed.
    const insufficient = e instanceof InsufficientCreditsError;
    const detail = insufficient
      ? "insufficient_credits"
      : e instanceof Error
        ? e.message
        : "feedback_failed";
    await markSubmissionFailed(db, submission.id, userId, detail);
    return insufficient
      ? Response.json({ error: "insufficient_credits" }, { status: 402 })
      : Response.json(
          { error: "feedback_failed", detail },
          { status: feedbackFailureStatus(e, workflow) },
        );
  }
}

/** Parse the bounded multipart bytes into audio + validated context. Returns
 * a Response for every client-caused shape problem. */
async function parseTrainingBody(
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Promise<{ audio: ArrayBuffer; context: TrainingContext } | Response> {
  // Re-wrap the already-bounded bytes so the platform multipart parser does
  // the boundary splitting; the raw Content-Type is required for its boundary
  // parameter.
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const audioPart = form.get("audio");
  if (!(audioPart instanceof File)) {
    return Response.json({ error: "missing_audio" }, { status: 400 });
  }
  // Some recorders leave the Blob type blank; treat that as octet-stream, the
  // same escape hatch /api/transcribe leaves open.
  const audioType =
    audioPart.type.split(";", 1)[0]?.trim().toLowerCase() ||
    "application/octet-stream";
  if (!AUDIO_MEDIA_TYPES.has(audioType)) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const contextPart = form.get("context");
  const contextRaw =
    typeof contextPart === "string"
      ? contextPart
      : contextPart instanceof File
        ? await contextPart.text()
        : null;
  if (contextRaw === null) {
    return Response.json({ error: "missing_context" }, { status: 400 });
  }
  const context = parseContext(contextRaw);
  if (!context) {
    return Response.json({ error: "bad_context" }, { status: 400 });
  }

  return { audio: await audioPart.arrayBuffer(), context };
}

/** Validate and bound the untrusted context JSON into a TrainingContext. */
function parseContext(raw: string): TrainingContext | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const c = parsed as Record<string, unknown>;

  const prompt = typeof c.prompt === "string" ? c.prompt.trim() : "";
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) return null;

  const drillSlug = c.drillSlug ?? null;
  if (drillSlug !== null) {
    if (typeof drillSlug !== "string" || !DRILL_SLUG_PATTERN.test(drillSlug)) {
      return null;
    }
  }

  const drillTitle = c.drillTitle ?? null;
  if (drillTitle !== null) {
    if (
      typeof drillTitle !== "string" ||
      !drillTitle.trim() ||
      drillTitle.length > MAX_DRILL_TITLE_CHARS
    ) {
      return null;
    }
  }

  const targetSeconds = c.targetSeconds ?? null;
  if (targetSeconds !== null) {
    if (
      typeof targetSeconds !== "number" ||
      !Number.isInteger(targetSeconds) ||
      targetSeconds <= 0 ||
      targetSeconds > MAX_TARGET_SECONDS
    ) {
      return null;
    }
  }

  // Goals reach the prompt, so only ids we defined are accepted. Silently
  // dropping unknown ids rather than rejecting keeps an older client working
  // after the goal list changes.
  const goals = Array.isArray(c.goals)
    ? c.goals
        .filter(
          (goal): goal is string =>
            typeof goal === "string" && KNOWN_GOAL_IDS.has(goal),
        )
        .slice(0, PRACTICE_GOALS.length)
    : [];

  return { drillSlug, drillTitle, prompt, targetSeconds, goals };
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
