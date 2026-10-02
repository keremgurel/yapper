import type { SubscriptionPlan } from "./plans";
import type { Product } from "./products";

export interface AllowanceSchedule {
  subscriptionId: string;
  planKey: string;
  /** Wallet the installments fill. Schedules stored before the split omit it
   * and are Studio. */
  product?: Product;
  start: number;
  end: number;
  months: number;
  credits: number;
}

/** Calendar anniversary, clamped without drifting after February or a short month. */
export function monthAnniversary(start: number, month: number): number {
  const date = new Date(start * 1000);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + month);
  const last = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.getTime() / 1000;
}

export function allowanceSchedule(
  plan: SubscriptionPlan,
  subscriptionId: string,
  start: number,
  end: number,
): AllowanceSchedule {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start <= 0 ||
    end <= start
  )
    throw new Error("invalid_paid_period");
  return {
    subscriptionId,
    planKey: plan.key,
    product: plan.product,
    start,
    end,
    months: !plan.legacy && plan.cadence === "year" ? 12 : 1,
    credits: plan.includedCredits,
  };
}

export function dueAllowances(
  schedule: AllowanceSchedule,
  now = Date.now() / 1000,
) {
  return Array.from({ length: schedule.months }, (_, index) => ({
    index,
    due: monthAnniversary(schedule.start, index),
    // Shared by invoice processing and scheduled refills, independent of webhook delivery order.
    reference: `allowance_${schedule.subscriptionId}_${schedule.start}_${index}`,
    credits: schedule.credits,
  })).filter((item) => item.due <= now && item.due < schedule.end);
}
