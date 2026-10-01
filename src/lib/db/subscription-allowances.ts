import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./client";
import { creditLedger, users } from "./schema";
import { grantCreditsIdempotent } from "./credits";
import {
  dueAllowances,
  type AllowanceSchedule,
} from "@/lib/billing/allowances";

/** The first paid installment also persists the schedule in the existing ledger.
 * No extra grant happens at checkout. One unique key per paid period/month. */
export async function grantDueAllowances(
  userId: string,
  schedule: AllowanceSchedule,
  now = Date.now() / 1000,
) {
  let granted = 0;
  for (const installment of dueAllowances(schedule, now)) {
    const result = await grantCreditsIdempotent(
      userId,
      installment.credits,
      "subscription_grant",
      installment.reference,
      {
        plan: schedule.planKey,
        source: "paid_allowance",
        ...(installment.index === 0 && schedule.months > 1
          ? { allowanceSchedule: schedule }
          : {}),
        installment: installment.index,
      },
    );
    if (result.granted) granted++;
  }
  return granted;
}

/** Keyset pagination ensures older schedules cannot starve later accounts. */
export async function refillAnnualAllowances(now = new Date()) {
  let after = "00000000-0000-0000-0000-000000000000";
  let granted = 0;
  let scanned = 0;
  for (;;) {
    const rows = await getDb()
      .select({
        id: creditLedger.id,
        userId: creditLedger.userId,
        metadata: creditLedger.metadata,
      })
      .from(creditLedger)
      .innerJoin(users, eq(users.id, creditLedger.userId))
      .where(
        and(
          gt(creditLedger.id, after),
          eq(creditLedger.reason, "subscription_grant"),
          sql`${creditLedger.metadata} ? 'allowanceSchedule'`,
          sql`(${creditLedger.metadata}->'allowanceSchedule'->>'end')::numeric > ${now.getTime() / 1000}`,
          sql`${users.subscriptionStatus} in ('active', 'past_due')`,
          sql`${users.plan} = ${creditLedger.metadata}->'allowanceSchedule'->>'planKey'`,
          sql`${users.currentPeriodEnd} = to_timestamp((${creditLedger.metadata}->'allowanceSchedule'->>'end')::double precision)`,
        ),
      )
      .orderBy(creditLedger.id)
      .limit(100);
    if (!rows.length) break;
    for (const row of rows) {
      const schedule = (
        row.metadata as { allowanceSchedule: AllowanceSchedule }
      ).allowanceSchedule;
      granted += await grantDueAllowances(
        row.userId,
        schedule,
        now.getTime() / 1000,
      );
      scanned++;
    }
    after = rows[rows.length - 1].id;
  }
  return { scanned, granted };
}
