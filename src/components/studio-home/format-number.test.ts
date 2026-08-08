import { describe, expect, it } from "vitest";
import { compactNumber } from "@/components/studio-home/format-number";

describe("compactNumber", () => {
  /** 1000 is the switch, and the boundary is the whole point of the function:
   * 999 must stay exact rather than rounding to "1K", which would overstate a
   * view count on a dashboard. */
  it("switches to compact notation at exactly 1000", () => {
    expect(compactNumber(999)).not.toMatch(/K/i);
    expect(compactNumber(999)).toContain("999");
    expect(compactNumber(1_000)).toMatch(/K/i);
  });

  it("keeps small counts exact", () => {
    expect(compactNumber(0)).toBe("0");
    expect(compactNumber(7)).toBe("7");
  });

  it("keeps one decimal of precision when compacting", () => {
    expect(compactNumber(1_234)).toMatch(/^1[.,]2\s?K$/i);
    // A round thousand should not gain a pointless ".0".
    expect(compactNumber(2_000)).toMatch(/^2\s?K$/i);
  });

  it("compacts beyond thousands", () => {
    expect(compactNumber(1_500_000)).toMatch(/M/i);
  });

  /** Negatives are not expected from a view count, but a subtraction upstream
   * can produce one and the dashboard should render it rather than crash. */
  it("survives a negative", () => {
    expect(compactNumber(-5)).toContain("5");
  });
});
