import { describe, expect, it } from "vitest";
import {
  isEntitled,
  isTrialing,
  lapsedMediaDeleteAt,
} from "@/lib/billing/entitlement";

const NOW = new Date("2026-07-16T00:00:00.000Z");
const days = (n: number): Date =>
  new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

const state = (
  subscriptionStatus: string | null,
  currentPeriodEnd: Date | null,
) => ({
  subscriptionStatus,
  currentPeriodEnd,
});

describe("isEntitled", () => {
  it("denies a missing or statusless billing state", () => {
    expect(isEntitled(null, NOW)).toBe(false);
    expect(isEntitled(state(null, days(30)), NOW)).toBe(false);
  });

  it("denies statuses that don't grant access", () => {
    for (const s of ["canceled", "unpaid", "incomplete", "paused"]) {
      // A future period must NOT rescue a non-entitled status.
      expect(isEntitled(state(s, days(30)), NOW)).toBe(false);
    }
  });

  it("grants trialing, active, and past_due within the period", () => {
    expect(isEntitled(state("trialing", days(7)), NOW)).toBe(true);
    expect(isEntitled(state("active", days(30)), NOW)).toBe(true);
    expect(isEntitled(state("past_due", days(1)), NOW)).toBe(true);
  });

  it("trusts an entitled status that has no period recorded yet", () => {
    expect(isEntitled(state("active", null), NOW)).toBe(true);
  });

  it("keeps access through the 3-day grace after the period ends", () => {
    // Ended 2 days ago: still inside the grace window.
    expect(isEntitled(state("active", days(-2)), NOW)).toBe(true);
  });

  it("cuts access once the period end plus grace has passed", () => {
    // Ended 4 days ago: past the 3-day grace, so a missed cancel webhook
    // can't leave the user entitled forever.
    expect(isEntitled(state("active", days(-4)), NOW)).toBe(false);
  });
});

describe("isTrialing", () => {
  it("is true only for the trialing status", () => {
    expect(isTrialing(state("trialing", days(7)))).toBe(true);
    expect(isTrialing(state("active", days(7)))).toBe(false);
    expect(isTrialing(null)).toBe(false);
  });
});

describe("lapsedMediaDeleteAt", () => {
  const now = new Date("2026-09-24T00:00:00Z");
  it("has no date while the account is entitled", () => {
    expect(
      lapsedMediaDeleteAt(
        {
          subscriptionStatus: "active",
          currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
        },
        now,
      ),
    ).toBeNull();
  });
  it("deletes 30 days after access ended (period end plus grace)", () => {
    expect(
      lapsedMediaDeleteAt(
        {
          subscriptionStatus: "canceled",
          currentPeriodEnd: new Date("2026-08-01T00:00:00Z"),
        },
        now,
      )?.toISOString(),
    ).toBe("2026-09-03T00:00:00.000Z");
  });
  it("never guesses a date for an account with no recorded period", () => {
    expect(
      lapsedMediaDeleteAt(
        { subscriptionStatus: null, currentPeriodEnd: null },
        now,
      ),
    ).toBeNull();
  });
});
