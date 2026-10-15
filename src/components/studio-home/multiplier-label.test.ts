import { describe, expect, it } from "vitest";
import { multiplierLabel } from "./multiplier-label";

describe("multiplierLabel", () => {
  it("reads like the Mac app", () => {
    expect(multiplierLabel(3.24)).toBe("3.2×");
    expect(multiplierLabel(12.4)).toBe("12×");
    expect(multiplierLabel(0.02)).toBe("<0.1×");
  });
});
