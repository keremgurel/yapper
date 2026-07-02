import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { WELCOME_CREDITS } from "./constants";
import { creditLedger, users } from "./schema";

/**
 * Create the user row on first sight (idempotent — safe for duplicate Clerk
 * webhooks) and grant the one-time welcome credits. Existing users just get
 * their email refreshed. Returns whether a new user was created.
 */
export async function ensureUser(
  id: string,
  email?: string | null,
): Promise<{ created: boolean }> {
  return getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(users)
      .values({ id, email: email ?? null, creditsBalance: WELCOME_CREDITS })
      .onConflictDoNothing({ target: users.id })
      .returning({ id: users.id });

    if (inserted.length === 0) {
      if (email) await tx.update(users).set({ email }).where(eq(users.id, id));
      return { created: false };
    }

    await tx.insert(creditLedger).values({
      userId: id,
      delta: WELCOME_CREDITS,
      reason: "welcome_grant",
      balanceAfter: WELCOME_CREDITS,
    });
    return { created: true };
  });
}

/** Remove a user (and, via cascade, their ledger + submissions). */
export async function deleteUser(id: string): Promise<void> {
  await getDb().delete(users).where(eq(users.id, id));
}

/** Adjust a user's running media-storage counter (clamped at 0). */
export async function addStorageBytes(
  id: string,
  delta: number,
): Promise<void> {
  await getDb()
    .update(users)
    .set({
      storageBytes: sql`greatest(0, ${users.storageBytes} + ${delta})`,
    })
    .where(eq(users.id, id));
}

/** Current storage usage (bytes) for quota checks. */
export async function getStorageBytes(id: string): Promise<number> {
  const [u] = await getDb()
    .select({ b: users.storageBytes })
    .from(users)
    .where(eq(users.id, id));
  return u?.b ?? 0;
}
