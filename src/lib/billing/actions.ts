import { canUsePremium } from "@/lib/billing/gate";
import {
  deductCredits,
  getBalance,
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
  publish_thumbnail: { credits: 2, label: "AI thumbnail" },
  ingest_context: { credits: 1, label: "Context import" },
  direct_overlays: { credits: 1, label: "AI overlay planning" },
  design_overlay: { credits: 2, label: "AI overlay design" },
  scene_image: { credits: 2, label: "AI overlay picture" },
  revise_overlay: { credits: 2, label: "AI overlay revision" },
  retime_overlay: { credits: 1, label: "AI overlay retiming" },
} as const;

export type PaidAction = keyof typeof PAID_ACTIONS;

/**
 * How many of the action one request pays for at once. The overlay designer
 * reserves for a whole batch of moments before any provider work so a batch
 * cannot half-succeed on credit; the cap keeps a single request from tying up
 * a large balance.
 */
export const MAX_RESERVATION_QUANTITY = 8;

export interface ReservationOptions {
  /** Units of the action, 1 to MAX_RESERVATION_QUANTITY. Defaults to 1. */
  quantity?: number;
}

function reservationQuantity(options: ReservationOptions): number {
  const quantity = options.quantity ?? 1;
  if (
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > MAX_RESERVATION_QUANTITY
  ) {
    throw new RangeError("invalid_reservation_quantity");
  }
  return quantity;
}

/** Cheap read-only access check used before consuming provider-spend budget.
 * The reservation immediately before provider work remains the atomic guard. */
export async function preflightPaidActionOrResponse(
  userId: string,
  action: PaidAction,
  options: ReservationOptions = {},
): Promise<Response | null> {
  const cost = PAID_ACTIONS[action].credits * reservationQuantity(options);
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    return Response.json({ error: "not_entitled" }, { status: 402 });
  }
  if ((await getBalance(userId)) < cost) {
    return Response.json({ error: "insufficient_credits" }, { status: 402 });
  }
  return null;
}

export class BillingAccessError extends Error {
  constructor(public readonly code: "not_entitled" | "insufficient_credits") {
    super(code);
    this.name = "BillingAccessError";
  }
}

export interface CreditReservation {
  action: PaidAction;
  /** Credits taken, which is the catalog price times the quantity. */
  cost: number;
  quantity: number;
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
  options: ReservationOptions = {},
): Promise<CreditReservation> {
  const quantity = reservationQuantity(options);
  await ensureUser(userId);
  if (!(await canUsePremium(userId))) {
    // Logged with the account and the action, because a 402 is indistinguishable
    // from the outside: "needs a subscription" and "out of credits" look the
    // same to a client, and an account that should have passed leaves no trace
    // of why it did not.
    console.warn("[billing] refused", { userId, action, code: "not_entitled" });
    throw new BillingAccessError("not_entitled");
  }

  const definition = PAID_ACTIONS[action];
  const cost = definition.credits * quantity;
  const usageId = crypto.randomUUID();
  try {
    const balance = await deductCredits(userId, cost, {
      metadata: { action, usageId, quantity },
    });
    return { action, cost, quantity, balance, usageId };
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      console.warn("[billing] refused", {
        userId,
        action,
        code: "insufficient_credits",
        cost,
      });
      throw new BillingAccessError("insufficient_credits");
    }
    throw error;
  }
}

export interface RefundOptions {
  /**
   * Credits to return, for a batch that partly succeeded. Defaults to the
   * whole reservation and never exceeds it.
   */
  amount?: number;
}

export async function refundCreditReservation(
  userId: string,
  reservation: CreditReservation,
  reason: string,
  options: RefundOptions = {},
): Promise<void> {
  const amount = Math.min(
    reservation.cost,
    Math.max(0, Math.floor(options.amount ?? reservation.cost)),
  );
  if (amount === 0) return;
  try {
    await grantCredits(userId, amount, "refund", {
      metadata: {
        action: reservation.action,
        usageId: reservation.usageId,
        reason: reason.slice(0, 200),
        ...(amount === reservation.cost ? {} : { partial: true }),
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
  options: ReservationOptions = {},
): Promise<
  | { reservation: CreditReservation; response?: never }
  | {
      reservation?: never;
      response: Response;
    }
> {
  try {
    return { reservation: await reservePaidAction(userId, action, options) };
  } catch (error) {
    const response = billingAccessResponse(error);
    if (response) return { response };
    throw error;
  }
}
