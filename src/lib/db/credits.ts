import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { creditLedger, users, type CreditReason } from "./schema";

/** Thrown by `deductCredits` when the user can't cover the cost. */
export class InsufficientCreditsError extends Error {
  constructor() {
    super("insufficient_credits");
    this.name = "InsufficientCreditsError";
  }
}

interface LedgerOpts {
  submissionId?: string;
  metadata?: Record<string, unknown>;
}

export async function getBalance(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ balance: users.creditsBalance })
    .from(users)
    .where(eq(users.id, userId));
  return row?.balance ?? 0;
}

/** Add credits (welcome grant, subscription refill, purchase, refund). Updates
 * the balance and writes the ledger entry atomically. Returns the new balance. */
export async function grantCredits(
  userId: string,
  amount: number,
  reason: CreditReason,
  opts: LedgerOpts = {},
): Promise<number> {
  if (amount <= 0) throw new Error("grant amount must be positive");
  return getDb().transaction(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.creditsBalance });
    if (!u) throw new Error("user not found");
    await tx.insert(creditLedger).values({
      userId,
      delta: amount,
      reason,
      balanceAfter: u.balance,
      submissionId: opts.submissionId,
      metadata: opts.metadata,
    });
    return u.balance;
  });
}

/**
 * Grant credits idempotently, keyed by a Stripe reference (invoice or checkout
 * session id). A redelivered webhook hits the unique `stripe_ref` and no-ops.
 * Returns the balance and whether this call actually granted.
 */
export async function grantCreditsIdempotent(
  userId: string,
  amount: number,
  reason: CreditReason,
  stripeRef: string,
  metadata?: Record<string, unknown>,
): Promise<{ balance: number; granted: boolean }> {
  if (amount <= 0) throw new Error("grant amount must be positive");
  return getDb().transaction(async (tx) => {
    const claimed = await tx
      .insert(creditLedger)
      .values({
        userId,
        delta: amount,
        reason,
        balanceAfter: 0, // set below once we know the new balance
        stripeRef,
        metadata,
      })
      .onConflictDoNothing({ target: creditLedger.stripeRef })
      .returning({ id: creditLedger.id });

    if (claimed.length === 0) {
      const [u] = await tx
        .select({ balance: users.creditsBalance })
        .from(users)
        .where(eq(users.id, userId));
      return { balance: u?.balance ?? 0, granted: false };
    }

    const [u] = await tx
      .update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.creditsBalance });
    if (!u) throw new Error("user not found");
    await tx
      .update(creditLedger)
      .set({ balanceAfter: u.balance })
      .where(eq(creditLedger.id, claimed[0].id));
    return { balance: u.balance, granted: true };
  });
}

/** Spend credits for an action. The conditional UPDATE only succeeds if the
 * balance covers the cost, so the check-and-decrement is atomic (no race).
 * Throws `InsufficientCreditsError` otherwise. Returns the new balance. */
export async function deductCredits(
  userId: string,
  amount: number,
  opts: LedgerOpts = {},
): Promise<number> {
  if (amount <= 0) throw new Error("deduct amount must be positive");
  return getDb().transaction(async (tx) => {
    const [u] = await tx
      .update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} - ${amount}` })
      .where(
        and(eq(users.id, userId), sql`${users.creditsBalance} >= ${amount}`),
      )
      .returning({ balance: users.creditsBalance });
    if (!u) throw new InsufficientCreditsError();
    await tx.insert(creditLedger).values({
      userId,
      delta: -amount,
      reason: "deduction",
      balanceAfter: u.balance,
      submissionId: opts.submissionId,
      metadata: opts.metadata,
    });
    return u.balance;
  });
}

/**
 * Return credits after a failed action. Idempotent per submission (a partial
 * unique index allows only one refund per submission_id) so the inline error
 * handler and the reconciliation sweep can both call it without double-refunding.
 * Returns the current balance.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  submissionId: string,
): Promise<number> {
  if (amount <= 0) throw new Error("refund amount must be positive");
  return getDb().transaction(async (tx) => {
    // Claim the single allowed refund for this submission.
    const claimed = await tx
      .insert(creditLedger)
      .values({
        userId,
        delta: amount,
        reason: "refund",
        balanceAfter: 0, // set below once we know the new balance
        submissionId,
      })
      .onConflictDoNothing({
        target: creditLedger.submissionId,
        where: sql`${creditLedger.reason} = 'refund'`,
      })
      .returning({ id: creditLedger.id });

    if (claimed.length === 0) {
      // Already refunded — no-op, return current balance.
      const [u] = await tx
        .select({ balance: users.creditsBalance })
        .from(users)
        .where(eq(users.id, userId));
      return u?.balance ?? 0;
    }

    const [u] = await tx
      .update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.creditsBalance });
    if (!u) throw new Error("user not found");
    await tx
      .update(creditLedger)
      .set({ balanceAfter: u.balance })
      .where(eq(creditLedger.id, claimed[0].id));
    return u.balance;
  });
}
