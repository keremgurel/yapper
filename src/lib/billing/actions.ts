import { canUsePremium } from "@/lib/billing/gate";
import {
  deductCredits,
  grantCredits,
  InsufficientCreditsError,
} from "@/lib/db/credits";
import { ensureUser } from "@/lib/db/users";

export const PAID_ACTIONS = {
  transcribe: { credits: 1, label: "Transcription" },
  clean_transcript: { credits: 1, label: "AI edit cleanup" },
  place_overlays: { credits: 1, label: "AI media placement" },
  reference_analysis: { credits: 2, label: "Reference analysis" },
  creator_analysis: { credits: 4, label: "Creator feed analysis" },
  capture_idea: { credits: 1, label: "Idea capture" },
  expand_idea: { credits: 2, label: "Idea expansion" },
  brainstorm: { credits: 1, label: "Idea brainstorm" },
  publish_caption: { credits: 1, label: "Publish copy" },
} as const;

export type PaidAction = keyof typeof PAID_ACTIONS;

export class BillingAccessError extends Error {
  constructor(public readonly code: "not_entitled" | "insufficient_credits") {
    super(code);
    this.name = "BillingAccessError";
  }
}

export interface CreditReservation {
  action: PaidAction;
  cost: number;
  balance: number;
  usageId: string;
}

/**
 * Atomically reserve credits before provider work. This closes the parallel-
 * request loophole where several calls could all pass a balance check before
 * any one of them deducted. Call refundCreditReservation when provider work
 * fails so the user never pays for an undelivered result.
 */
export async function reservePaidAction(
  userId: string,
  action: PaidAction,
): Promise<CreditReservation> {
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    throw new BillingAccessError("not_entitled");
  }

  const definition = PAID_ACTIONS[action];
  const usageId = crypto.randomUUID();
  try {
    const balance = await deductCredits(userId, definition.credits, {
      metadata: { action, usageId },
    });
    return { action, cost: definition.credits, balance, usageId };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      throw new BillingAccessError("insufficient_credits");
    }
    throw error;
  }
}

export async function refundCreditReservation(
  userId: string,
  reservation: CreditReservation,
  reason: string,
): Promise<void> {
  try {
    await grantCredits(userId, reservation.cost, "refund", {
      metadata: {
        action: reservation.action,
        usageId: reservation.usageId,
        reason: reason.slice(0, 200),
      },
    });
  } catch (error) {
    // Never hide the provider failure with a refund failure. The usageId makes
    // this ledger anomaly traceable for manual repair.
    console.error("[billing] credit refund failed", {
      action: reservation.action,
      usageId: reservation.usageId,
      error,
    });
  }
}

export function billingAccessResponse(error: unknown): Response | null {
  if (!(error instanceof BillingAccessError)) return null;
  return Response.json({ error: error.code }, { status: 402 });
}

export async function reservePaidActionOrResponse(
  userId: string,
  action: PaidAction,
): Promise<
  | { reservation: CreditReservation; response?: never }
  | {
      reservation?: never;
      response: Response;
    }
> {
  try {
    return { reservation: await reservePaidAction(userId, action) };
  } catch (error) {
    const response = billingAccessResponse(error);
    if (response) return { response };
    throw error;
  }
}
