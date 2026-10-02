import { describe, expect, it } from "vitest";
import { trainSharesStudioWallet } from "./shared-wallet";

describe("which accounts keep one balance for both products", () => {
  it("keeps the shared balance for plans sold before the split", () => {
    for (const plan of ["creator_weekly", "creator_monthly", "creator_yearly"])
      expect(
        trainSharesStudioWallet({ subscriptionStatus: "active", plan }),
      ).toBe(true);
    // A canceled legacy plan still owns whatever it has left.
    expect(
      trainSharesStudioWallet({
        subscriptionStatus: "canceled",
        plan: "creator_monthly",
      }),
    ).toBe(true);
  });
  it("lets an account that never subscribed spend its welcome credits", () => {
    expect(
      trainSharesStudioWallet({ subscriptionStatus: null, plan: null }),
    ).toBe(true);
  });
  it("keeps current Studio credits out of Train", () => {
    for (const subscriptionStatus of ["trialing", "active", "canceled"])
      expect(
        trainSharesStudioWallet({
          subscriptionStatus,
          plan: "studio_creator_monthly",
        }),
      ).toBe(false);
    // Status known but the plan could not be mapped: not a legacy plan.
    expect(
      trainSharesStudioWallet({ subscriptionStatus: "active", plan: null }),
    ).toBe(false);
  });
});
