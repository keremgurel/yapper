import { describe, expect, it } from "vitest";
import {
  allowanceSchedule,
  dueAllowances,
  monthAnniversary,
} from "./allowances";
import { planByKey, SUBSCRIPTION_PLANS, CREDIT_PACKS } from "./plans";
import { transcriptionUnits, cleanupUnits } from "./credit-costs";

const stamp = (value: string) => Date.parse(value) / 1000;
describe("monthly allowances and catalog", () => {
  it("offers only monthly and yearly while keeping legacy entitlements readable", () => {
    expect(SUBSCRIPTION_PLANS).toHaveLength(6);
    expect(SUBSCRIPTION_PLANS.some((plan) => plan.cadence === "week")).toBe(
      false,
    );
    expect(planByKey("creator_weekly")?.legacy).toBe(true);
    expect(planByKey("creator_yearly")?.includedCredits).toBe(6000);
  });
  it("keeps the same monthly credits on yearly billing with exactly 20% savings", () => {
    for (const plan of SUBSCRIPTION_PLANS.filter(
      (plan) => plan.cadence === "month",
    )) {
      const annual = SUBSCRIPTION_PLANS.find(
        (other) => other.tier === plan.tier && other.cadence === "year",
      )!;
      expect(annual.includedCredits).toBe(plan.includedCredits);
      expect(annual.priceCents).toBe(plan.priceCents! * 12 * 0.8);
    }
  });
  it("clamps monthly anniversaries without drifting after February", () => {
    const start = stamp("2028-01-31T12:45:00Z");
    expect(monthAnniversary(start, 1)).toBe(stamp("2028-02-29T12:45:00Z"));
    expect(monthAnniversary(start, 2)).toBe(stamp("2028-03-31T12:45:00Z"));
  });
  it("releases one installment initially, catches up, and never creates a 13th", () => {
    const start = stamp("2026-10-01T09:00:00Z");
    const schedule = allowanceSchedule(
      planByKey("studio_creator_yearly")!,
      "sub_1",
      start,
      stamp("2027-10-01T09:00:00Z"),
    );
    expect(dueAllowances(schedule, start - 1)).toHaveLength(0);
    expect(dueAllowances(schedule, start).map((item) => item.credits)).toEqual([
      500,
    ]);
    expect(dueAllowances(schedule, stamp("2026-12-01T09:00:00Z"))).toHaveLength(
      3,
    );
    const due = dueAllowances(schedule, stamp("2028-01-01T00:00:00Z"));
    expect(due).toHaveLength(12);
    expect(new Set(due.map((item) => item.reference)).size).toBe(12);
    expect(due.reduce((sum, item) => sum + item.credits, 0)).toBe(6000);
  });
  it("does not make packs cheaper than Creator/Pro subscription credits", () => {
    const largestRate = Math.max(
      ...SUBSCRIPTION_PLANS.filter((plan) => plan.tier !== "starter").map(
        (plan) => plan.monthlyEquivalentCents! / plan.monthlyCredits!,
      ),
    );
    expect(
      CREDIT_PACKS.every(
        (pack) => pack.priceCents! / pack.credits > largestRate,
      ),
    ).toBe(true);
  });
  it("meets the modeled 75% contribution target at full credit and storage utilization", () => {
    for (const plan of SUBSCRIPTION_PLANS) {
      const months = plan.cadence === "year" ? 12 : 1;
      const revenue = plan.priceCents! / 100 / months;
      const fees = ((plan.priceCents! / 100) * 0.036 + 0.3) / months;
      const storageAndCompute = (plan.storageBytes / 1024 ** 3) * 0.015 + 1;
      const providerBudget = plan.monthlyCredits! * 0.006;
      expect(
        (revenue - fees - storageAndCompute - providerBudget) / revenue,
      ).toBeGreaterThanOrEqual(0.75);
    }
  });
});
describe("source duration prices", () => {
  it("rounds submitted audio once at minute boundaries", () => {
    expect(transcriptionUnits(30)).toBe(1);
    expect(transcriptionUnits(60)).toBe(1);
    expect(transcriptionUnits(60.01)).toBe(2);
    expect(transcriptionUnits(3600)).toBe(60);
    expect(() => transcriptionUnits(NaN)).toThrow();
    expect(() => transcriptionUnits(3601)).toThrow();
  });
  it("prices retake cleanup in five-minute bands", () => {
    expect(cleanupUnits(300)).toBe(1);
    expect(cleanupUnits(301)).toBe(2);
    expect(cleanupUnits(3600)).toBe(12);
  });
});
