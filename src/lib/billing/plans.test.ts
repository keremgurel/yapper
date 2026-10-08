import { describe, expect, it, vi } from "vitest";
import {
  LEGACY_STUDIO_PLANS,
  plansFor,
  planByKey,
  planByPriceId,
} from "./plans";

describe("Studio plan retirement", () => {
  it("sells only monthly and yearly memberships", () => {
    expect(plansFor("studio").map((plan) => plan.key)).toEqual([
      "creator_monthly",
      "creator_yearly",
    ]);
  });
  it("still recognizes weekly subscriptions and renewal prices", () => {
    const weekly = planByKey("creator_weekly")!;
    expect(weekly.includedCredits).toBe(100);
    expect(weekly.storageBytes).toBe(5 * 1024 ** 3);
    const spy = vi
      .spyOn(LEGACY_STUDIO_PLANS[0], "priceId", "get")
      .mockReturnValue("price_existing_weekly");
    expect(planByPriceId("price_existing_weekly")).toBe(weekly);
    spy.mockRestore();
  });
});
