import { and, desc, eq } from "drizzle-orm";
import type { BetaApplicationInput } from "@/lib/studio-beta/application";
import { getDb } from "./client";
import { studioBetaApplications, type StudioBetaStatus } from "./schema";

export type BetaApplication = typeof studioBetaApplications.$inferSelect;

/**
 * Record an application. An email that has already applied keeps its original
 * row and status, so applying twice neither duplicates it nor resets a
 * decision. Returns whether this call created the row.
 */
export async function createBetaApplication(
  input: BetaApplicationInput,
): Promise<{ created: boolean }> {
  const inserted = await getDb()
    .insert(studioBetaApplications)
    .values(input)
    .onConflictDoNothing({ target: studioBetaApplications.email })
    .returning({ id: studioBetaApplications.id });
  return { created: inserted.length > 0 };
}

/** Every application, newest first. The beta is small; no paging yet. */
export async function listBetaApplications(): Promise<BetaApplication[]> {
  return getDb()
    .select()
    .from(studioBetaApplications)
    .orderBy(desc(studioBetaApplications.createdAt))
    .limit(500);
}

export async function findBetaApplication(
  id: string,
): Promise<BetaApplication | null> {
  const [row] = await getDb()
    .select()
    .from(studioBetaApplications)
    .where(eq(studioBetaApplications.id, id));
  return row ?? null;
}

/** Approve and issue (or reissue) the access code in one write. */
export async function approveBetaApplication(
  id: string,
  adminId: string,
  accessCodeHash: string,
): Promise<BetaApplication | null> {
  const [row] = await getDb()
    .update(studioBetaApplications)
    .set({
      status: "approved",
      accessCodeHash,
      decidedBy: adminId,
      decidedAt: new Date(),
    })
    .where(eq(studioBetaApplications.id, id))
    .returning();
  return row ?? null;
}

/** Reject a pending application or revoke an approved one. Either way the
 * access code stops working at once. */
export async function closeBetaApplication(
  id: string,
  adminId: string,
  status: Extract<StudioBetaStatus, "rejected" | "revoked">,
): Promise<BetaApplication | null> {
  const [row] = await getDb()
    .update(studioBetaApplications)
    .set({
      status,
      accessCodeHash: null,
      decidedBy: adminId,
      decidedAt: new Date(),
    })
    .where(eq(studioBetaApplications.id, id))
    .returning();
  return row ?? null;
}

export async function markBetaInvited(id: string): Promise<void> {
  await getDb()
    .update(studioBetaApplications)
    .set({ invitedAt: new Date() })
    .where(eq(studioBetaApplications.id, id));
}

/** The approved application this email and code hash belong to, recording the
 * visit. Null for a wrong code, an unknown email, or a closed application. */
export async function redeemBetaAccess(
  email: string,
  accessCodeHash: string,
): Promise<{ id: string } | null> {
  const [row] = await getDb()
    .update(studioBetaApplications)
    .set({ lastAccessAt: new Date() })
    .where(
      and(
        eq(studioBetaApplications.email, email),
        eq(studioBetaApplications.accessCodeHash, accessCodeHash),
        eq(studioBetaApplications.status, "approved"),
      ),
    )
    .returning({ id: studioBetaApplications.id });
  return row ?? null;
}

export async function isBetaApplicationApproved(id: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ status: studioBetaApplications.status })
    .from(studioBetaApplications)
    .where(eq(studioBetaApplications.id, id));
  return row?.status === "approved";
}
