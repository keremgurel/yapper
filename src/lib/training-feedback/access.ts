import { isEntitled } from "@/lib/billing/entitlement";
import { fairUseResetsAt, withinFairUse } from "@/lib/billing/train-fair-use";
import { getBillingState } from "@/lib/db/billing";
import { TRAINING_FEEDBACK_CREDITS } from "@/lib/db/constants";
import { getTrainSpendable } from "@/lib/db/train-wallet";
import { countTrainSessionsToday } from "@/lib/db/train-usage";

/** How a feedback session is paid for: by a Train Plus plan, or by credits
 * (the welcome session, or a balance from before the products were split). */
export type TrainFeedbackAccess = "plan" | "credits";

/**
 * Decide whether this user may run a feedback session now, before any
 * provider work. Train Plus subscribers are unlimited up to the fair-use
 * ceiling. Everyone else needs enough credits for one session. Returns the
 * refusal as a Response.
 */
export async function resolveTrainFeedbackAccess(
  userId: string,
  now: Date = new Date(),
): Promise<TrainFeedbackAccess | Response> {
  if (isEntitled(await getBillingState(userId, "train"), now)) {
    if (withinFairUse(await countTrainSessionsToday(userId, now)))
      return "plan";
    return Response.json(
      { error: "fair_use_limit", resetsAt: fairUseResetsAt(now).toISOString() },
      { status: 429 },
    );
  }
  if ((await getTrainSpendable(userId)) < TRAINING_FEEDBACK_CREDITS)
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  return "credits";
}
