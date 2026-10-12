import { describe, expect, it } from "vitest";
import {
  centsPerCredit,
  FINISHED_VIDEO_CREDITS,
  finishedVideos,
  referenceAnalyses,
} from "./credit-equivalents";
import { CREDIT_PACKS, STUDIO_PLANS } from "./plans";

describe("credit equivalents", () => {
  it("prices a finished video from the catalog", () => {
    expect(FINISHED_VIDEO_CREDITS).toBe(107);
  });

  it("lets the monthly allowance cover a regular posting schedule", () => {
    // Two or more finished videos a week, overlays included.
    const monthly = STUDIO_PLANS.find((p) => p.key === "creator_monthly")!;
    expect(finishedVideos(monthly.includedCredits)).toBeGreaterThanOrEqual(8);
  });

  it("counts whole units only", () => {
    expect(finishedVideos(106)).toBe(0);
    expect(finishedVideos(-5)).toBe(0);
    expect(referenceAnalyses(100)).toBe(12);
  });

  it("never sells a pack below the plan's own credit rate", () => {
    const monthly = STUDIO_PLANS.find((p) => p.key === "creator_monthly")!;
    const planCents = 2499 / monthly.includedCredits;
    for (const pack of CREDIT_PACKS) {
      expect(centsPerCredit(pack)).toBeGreaterThan(planCents);
    }
  });

  it("reads a price label", () => {
    expect(centsPerCredit({ credits: 300, priceLabel: "$19" })).toBeCloseTo(
      6.333,
    );
    expect(centsPerCredit({ credits: 0, priceLabel: "$9" })).toBeNull();
  });
});
