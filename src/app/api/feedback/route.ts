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

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Get AI feedback on a recording. Auth required (this is the credit action).
 * Flow: ensure the user row exists → create a pending submission → deduct
 * credits → run the pipeline → store the result. Refunds + marks failed on any
 * pipeline error, so a failure never costs the user a credit.
 *
 * v1: `tier=audio` only. Video/full arrive with R2 uploads in the next phase.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const tier = (new URL(req.url).searchParams.get("tier") ??
    "audio") as FeedbackTier;
  if (tier !== "audio") {
    return Response.json(
      { error: "tier_not_available", detail: `${tier} feedback ships soon` },
      { status: 400 },
    );
  }
  const cost = FEEDBACK_CREDITS[tier];

  const audio = await req.arrayBuffer();
  if (audio.byteLength === 0) {
    return Response.json({ error: "empty_audio" }, { status: 400 });
  }

  // Lazily create the user + welcome grant (safety net if the Clerk webhook
  // hasn't fired / isn't configured yet).
  await ensureUser(userId);

  const db = getDb();
  const [submission] = await db
    .insert(submissions)
    .values({ userId, kind: "audio", status: "processing", creditsCost: cost })
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
    const result = await runAudioFeedback(audio);
    await db
      .update(submissions)
      .set({
        status: "complete",
        durationSec: result.metrics.durationSec,
        transcript: result.words,
        feedback: { metrics: result.metrics, coaching: result.coaching },
        scores: { delivery: result.coaching.score },
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, submission.id));

    const balance = await getBalance(userId);
    return Response.json({
      submissionId: submission.id,
      balance,
      transcript: result.transcript,
      metrics: result.metrics,
      coaching: result.coaching,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "feedback_failed";
    // Refund and mark-failed independently and best-effort — one failing must
    // not block the other. The reconciliation sweep is the ultimate backstop
    // (refund is idempotent, so a double-fire is safe).
    let balance: number | undefined;
    try {
      balance = await refundCredits(userId, cost, submission.id);
    } catch {
      // reconcile sweep will retry the refund
    }
    try {
      await db
        .update(submissions)
        .set({ status: "failed", error: detail, updatedAt: new Date() })
        .where(eq(submissions.id, submission.id));
    } catch {
      // reconcile sweep will fail the stranded submission
    }
    return Response.json(
      { error: "feedback_failed", detail, balance },
      { status: 502 },
    );
  }
}
