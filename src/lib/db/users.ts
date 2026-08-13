import { eq, sql } from "drizzle-orm";
import { getDb } from "./client";
import { WELCOME_CREDITS } from "./constants";
import { enqueueAllUserObjectsWithinTx } from "./r2-lifecycle";
import { lockStorageUserWithinTx } from "./storage-accounting";
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

/** Remove a user (and, via cascade, their ledger + submissions). Every owned
 * R2 object is first queued for durable deletion in the same transaction, so
 * account rows can disappear without losing the cleanup work. */
export async function deleteUser(id: string): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, id);
    // Lock the account before taking the cleanup snapshot. Imported-media
    // registration updates this same row, so it either commits first and is
    // included here, or observes the deleted user and rolls back its attempt.
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .for("update")
      .limit(1);
    if (!user) return;

    await enqueueAllUserObjectsWithinTx(tx, id, "account_deleted");
    await tx.delete(users).where(eq(users.id, id));
  });
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
