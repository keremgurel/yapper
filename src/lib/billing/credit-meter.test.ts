import { describe, expect, it } from "vitest";
import { creditMeterFor } from "./credit-meter";

const monthly = {
  balance: 1000,
  plan: "creator_monthly",
  trialing: false,
  entitled: true,
};

describe("account credit indicator", () => {
  it("uses the plan's actual payment allocation, including annual and legacy plans", () => {
    expect(creditMeterFor(monthly)).toMatchObject({
      fraction: 1,
      allowance: 1000,
      lightColor: "#0e9f6e",
      darkColor: "#34d399",
    });
    expect(
      creditMeterFor({ ...monthly, plan: "creator_yearly", balance: 6000 }),
    ).toMatchObject({ fraction: 0.5, allowance: 12000, darkColor: "#ffc247" });
    expect(
      creditMeterFor({ ...monthly, plan: "creator_weekly", balance: 10 })
        .fraction,
    ).toBe(0.1);
  });
  it("uses the trial grant instead of the future paid allocation", () => {
    expect(
      creditMeterFor({ ...monthly, trialing: true, balance: 50 }),
    ).toMatchObject({
      allowance: 100,
      fraction: 0.5,
      planLabel: "Studio trial",
    });
  });
  it("clamps purchased credits and zero without inventing an allocation", () => {
    expect(creditMeterFor({ ...monthly, balance: 99768 }).fraction).toBe(1);
    expect(creditMeterFor({ ...monthly, balance: -1 })).toMatchObject({
      fraction: 0,
      darkColor: "#ff6b6b",
    });
    expect(
      creditMeterFor({ ...monthly, plan: null, balance: 50 }),
    ).toMatchObject({ fraction: null, allowance: null });
    expect(
      creditMeterFor({ ...monthly, plan: null, balance: 0 }).fraction,
    ).toBe(0);
    expect(creditMeterFor({ ...monthly, balance: NaN }).fraction).toBeNull();
  });
  it("blends continuously on either side of amber", () => {
    expect(creditMeterFor({ ...monthly, balance: 250 }).darkColor).toBe(
      "#ff9759",
    );
    expect(creditMeterFor({ ...monthly, balance: 750 }).darkColor).toBe(
      "#9acb70",
    );
  });
  it("does not present an expired subscription as active", () => {
    expect(creditMeterFor({ ...monthly, entitled: false }).planLabel).toBe(
      "No active membership",
    );
  });
});
