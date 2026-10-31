import { createHash } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { chirpyPlans } from "@/lib/db/schema";
import type { StudioEffect, StudioReceiptStatus } from "./wire";

/**
 * Receipts for server actions, so a retried turn never runs one twice and a
 * confirmation runs exactly the action that was shown.
 *
 * They live in chirpy_plans, Chirpy's idempotency ledger keyed by user and
 * execution: each action is an execution of its own, with a UUID derived from
 * its turn's execution ID and its position in the plan. The primary key makes
 * the claim atomic, so no second table or migration is needed.
 */
export interface StudioInvocation {
  kind: "studio-action";
  executionID: string;
  index: number;
  action: string;
  arguments: Record<string, unknown>;
  status: StudioReceiptStatus | "pending";
  /** The confirmation question's subject, for pending actions. */
  label?: string;
  summary?: string;
  effects?: StudioEffect[];
  partial?: boolean;
}

/** A pending action can be confirmed this long after it was proposed. */
export const PENDING_MINUTES = 30;

/** A stable UUID for the index-th action of a turn. */
export function invocationID(executionID: string, index: number): string {
  const hex = createHash("sha256")
    .update(`chirpy-studio:${executionID.toLowerCase()}:${index}`)
    .digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function fingerprint(record: StudioInvocation): string {
  return createHash("sha256")
    .update(JSON.stringify([record.action, record.arguments]))
    .digest("hex");
}

const isInvocation = sql`${chirpyPlans.response}->>'kind' = 'studio-action'`;

/**
 * Insert the invocation if it is new. Returns null when this caller now owns
 * it, or the stored record when it already existed (a retry, or a confirmation
 * that was already answered).
 */
export async function claimInvocation(
  userId: string,
  projectID: string,
  record: StudioInvocation,
): Promise<StudioInvocation | null> {
  const id = invocationID(record.executionID, record.index);
  const inserted = await getDb()
    .insert(chirpyPlans)
    .values({
      userId,
      executionId: id,
      projectId: projectID,
      fingerprint: fingerprint(record),
      response: record as unknown as Record<string, unknown>,
    })
    .onConflictDoNothing()
    .returning({ id: chirpyPlans.executionId });
  if (inserted.length) return null;
  const [existing] = await getDb()
    .select({ response: chirpyPlans.response })
    .from(chirpyPlans)
    .where(
      and(eq(chirpyPlans.userId, userId), eq(chirpyPlans.executionId, id)),
    );
  return (existing?.response as unknown as StudioInvocation) ?? null;
}

export async function finishInvocation(
  userId: string,
  record: StudioInvocation,
): Promise<void> {
  await getDb()
    .update(chirpyPlans)
    .set({ response: record as unknown as Record<string, unknown> })
    .where(
      and(
        eq(chirpyPlans.userId, userId),
        eq(
          chirpyPlans.executionId,
          invocationID(record.executionID, record.index),
        ),
      ),
    );
}

/** Every invocation of one turn, in plan order. */
export async function turnInvocations(
  userId: string,
  executionID: string,
): Promise<StudioInvocation[]> {
  const rows = await getDb()
    .select({ response: chirpyPlans.response })
    .from(chirpyPlans)
    .where(
      and(
        eq(chirpyPlans.userId, userId),
        isInvocation,
        sql`${chirpyPlans.response}->>'executionID' = ${executionID.toLowerCase()}`,
      ),
    );
  return rows
    .map((row) => row.response as unknown as StudioInvocation)
    .sort((a, b) => a.index - b.index);
}

/**
 * Move a turn's pending actions to running, atomically. Only the caller that
 * moves them runs them, so two confirmations cannot both delete. Expired
 * proposals are left alone.
 */
export async function takePending(
  userId: string,
  executionID: string,
  next: "running" | "canceled",
): Promise<StudioInvocation[]> {
  const rows = await getDb()
    .update(chirpyPlans)
    .set({
      response: sql`jsonb_set(${chirpyPlans.response}, '{status}', to_jsonb(${next}::text))`,
    })
    .where(
      and(
        eq(chirpyPlans.userId, userId),
        isInvocation,
        sql`${chirpyPlans.response}->>'executionID' = ${executionID.toLowerCase()}`,
        sql`${chirpyPlans.response}->>'status' = 'pending'`,
        gt(
          chirpyPlans.createdAt,
          sql`now() - make_interval(mins => ${PENDING_MINUTES})`,
        ),
      ),
    )
    .returning({ response: chirpyPlans.response });
  return rows
    .map((row) => row.response as unknown as StudioInvocation)
    .sort((a, b) => a.index - b.index);
}

/** The turn whose actions most recently started waiting for the creator. */
export async function latestPendingExecution(
  userId: string,
): Promise<string | null> {
  const [row] = await getDb()
    .select({ response: chirpyPlans.response })
    .from(chirpyPlans)
    .where(
      and(
        eq(chirpyPlans.userId, userId),
        isInvocation,
        sql`${chirpyPlans.response}->>'status' = 'pending'`,
        gt(
          chirpyPlans.createdAt,
          sql`now() - make_interval(mins => ${PENDING_MINUTES})`,
        ),
      ),
    )
    .orderBy(desc(chirpyPlans.createdAt))
    .limit(1);
  return (
    (row?.response as { executionID?: string } | undefined)?.executionID ?? null
  );
}
