import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { deductWithinTx } from "@/lib/db/credits";
import { chirpyPlans } from "@/lib/db/schema";
import { PAID_ACTIONS } from "@/lib/billing/actions";

export class PlanConflict extends Error {}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
/** What any Chirpy planning request carries for the ledger: its idempotency
 * key and the project (editor or Studio) it ran in. */
export interface PlanLedgerInput {
  executionID: string;
  projectID: string;
}

/** Serialize duplicate executions across server instances. The credit reserve
 * and cached reply commit together; a failed provider call rolls both back.
 * The provider has a 40s wall-clock cap and never retries an invalid plan.
 * Nothing that spends credits may run inside `generate`: the reserve holds the
 * creator's balance row until the transaction commits. */
export async function withPlanLedger<Input extends PlanLedgerInput, Reply>(
  userId: string,
  input: Input,
  generate: () => Promise<Reply>,
): Promise<Reply> {
  const fingerprint = createHash("sha256")
    .update(canonical(input))
    .digest("hex");
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = '50s'`);
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${userId}), hashtext(${input.executionID}))`,
    );
    const [existing] = await tx
      .select()
      .from(chirpyPlans)
      .where(
        and(
          eq(chirpyPlans.userId, userId),
          eq(chirpyPlans.executionId, input.executionID),
        ),
      );
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new PlanConflict("execution_conflict");
      return existing.response as unknown as Reply;
    }
    await deductWithinTx(tx, userId, PAID_ACTIONS.chirpy_plan.credits, {
      metadata: {
        action: "chirpy_plan",
        usageId: input.executionID,
        projectId: input.projectID,
      },
    });
    const response = await generate();
    await tx.insert(chirpyPlans).values({
      userId,
      executionId: input.executionID,
      projectId: input.projectID,
      fingerprint,
      response: response as unknown as Record<string, unknown>,
    });
    return response;
  });
}
