import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "./client";
import { creditLedger, users } from "./schema";
import { grantCreditsIdempotent } from "./credits";
import {
  dueAllowances,
  type AllowanceSchedule,
} from "@/lib/billing/allowances";
import { DEFAULT_PRODUCT, PRODUCTS } from "@/lib/billing/products";
import { subscriptionColumns } from "./wallet";

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
      schedule.product ?? DEFAULT_PRODUCT,
    );
    if (result.granted) granted++;
  }
  return granted;
}

/** Each product's annual schedules are matched against that product's own
 * subscription mirror, so a canceled Train plan cannot keep refilling because
 * Studio is still active, or the reverse. */
export async function refillAnnualAllowances(now = new Date()) {
  let granted = 0;
  let scanned = 0;
  for (const product of PRODUCTS) {
    const result = await refillProductAllowances(product, now);
    granted += result.granted;
    scanned += result.scanned;
  }
  return { scanned, granted };
}

/** Keyset pagination ensures older schedules cannot starve later accounts. */
async function refillProductAllowances(
  product: (typeof PRODUCTS)[number],
  now: Date,
) {
  const subscription = subscriptionColumns(product);
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
          eq(creditLedger.product, product),
          sql`${creditLedger.metadata} ? 'allowanceSchedule'`,
          sql`(${creditLedger.metadata}->'allowanceSchedule'->>'end')::numeric > ${now.getTime() / 1000}`,
          sql`${subscription.subscriptionStatus} in ('active', 'past_due')`,
          sql`${subscription.plan} = ${creditLedger.metadata}->'allowanceSchedule'->>'planKey'`,
          sql`${subscription.currentPeriodEnd} = to_timestamp((${creditLedger.metadata}->'allowanceSchedule'->>'end')::double precision)`,
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
