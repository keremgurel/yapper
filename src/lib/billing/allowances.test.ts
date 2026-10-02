import { describe, expect, it } from "vitest";
import {
  allowanceSchedule,
  dueAllowances,
  monthAnniversary,
} from "./allowances";
import {
  planByKey,
  packsFor,
  plansFor,
  STUDIO_PLANS,
  TRAIN_PLANS,
} from "./plans";
import { TRAIN_FAIR_USE_DAILY_SESSIONS } from "./train-fair-use";
import { transcriptionUnits, cleanupUnits } from "./credit-costs";

const stamp = (value: string) => Date.parse(value) / 1000;
describe("monthly allowances and catalog", () => {
  it("offers only monthly and yearly while keeping legacy entitlements readable", () => {
    expect(STUDIO_PLANS).toHaveLength(6);
    expect(TRAIN_PLANS).toHaveLength(2);
    expect(
      [...STUDIO_PLANS, ...TRAIN_PLANS].some((plan) => plan.cadence === "week"),
    ).toBe(false);
    expect(planByKey("creator_weekly")?.legacy).toBe(true);
    expect(planByKey("creator_yearly")?.includedCredits).toBe(6000);
  });
  it("keeps the same monthly credits on yearly billing with exactly 20% savings", () => {
    const plans = [...STUDIO_PLANS, ...TRAIN_PLANS];
    for (const plan of plans.filter((plan) => plan.cadence === "month")) {
      const annual = plans.find(
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
      ...STUDIO_PLANS.filter((plan) => plan.tier !== "starter").map(
        (plan) => plan.monthlyEquivalentCents! / plan.monthlyCredits!,
      ),
    );
    expect(
      packsFor("studio").every(
        (pack) => pack.priceCents! / pack.credits > largestRate,
      ),
    ).toBe(true);
  });
  it("meets the modeled 75% contribution target at full credit and storage utilization", () => {
    for (const plan of STUDIO_PLANS) {
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
describe("product separation in the catalog", () => {
  it("keeps every plan and pack inside one product", () => {
    expect(plansFor("studio")).toEqual(STUDIO_PLANS);
    expect(plansFor("train")).toEqual(TRAIN_PLANS);
    expect(packsFor("train")).toEqual([]);
    expect(packsFor("studio").some((pack) => pack.product !== "studio")).toBe(
      false,
    );
  });
  it("sells Train as an unlimited plan: no credits, no trial, no storage", () => {
    for (const plan of TRAIN_PLANS) {
      expect(plan.includedCredits).toBe(0);
      expect(plan.trial).toBe(false);
      expect(plan.storageBytes).toBe(0);
    }
    expect(STUDIO_PLANS.every((plan) => plan.trial)).toBe(true);
  });
  it("keeps Train above 65% modeled contribution at two sessions a day, and shows the loss at the fair-use ceiling", () => {
    // $0.03 a session is the planning cost. See docs/pricing-2026-10.md.
    for (const plan of TRAIN_PLANS) {
      const months = plan.cadence === "year" ? 12 : 1;
      const revenue = plan.priceCents! / 100 / months;
      const fees = ((plan.priceCents! / 100) * 0.036 + 0.3) / months;
      const contribution = (sessions: number) =>
        (revenue - fees - 0.25 - sessions * 0.03) / revenue;
      // Two sessions every day of the month.
      expect(contribution(60)).toBeGreaterThanOrEqual(0.65);
      // Someone at the ceiling every day costs more than they pay. The
      // ceiling bounds that loss; this documents it instead of hiding it.
      expect(contribution(TRAIN_FAIR_USE_DAILY_SESSIONS * 30)).toBeLessThan(0);
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
