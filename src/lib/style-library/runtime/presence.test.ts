import { describe, expect, it } from "vitest";
import { cubicBezier, easeOutSettle } from "./easing";
import { presence } from "./presence";

describe("cubicBezier", () => {
  it("is the identity for a straight line", () => {
    const linear = cubicBezier(0.25, 0.25, 0.75, 0.75);
    for (const x of [0, 0.1, 0.5, 0.9, 1]) expect(linear(x)).toBeCloseTo(x, 4);
  });

  it("matches CSS ease-out-settle at known points", () => {
    // cubic-bezier(0.22, 1, 0.36, 1): fast out, long settle.
    expect(easeOutSettle(0)).toBe(0);
    expect(easeOutSettle(1)).toBe(1);
    expect(easeOutSettle(0.25)).toBeGreaterThan(0.7);
    expect(easeOutSettle(0.5)).toBeGreaterThan(0.95);
  });
});

describe("presence", () => {
  it("is absent outside its time, full in the middle", () => {
    expect(presence(-0.1, 4, 0.2, 0.15)).toBe(0);
    expect(presence(2, 4, 0.2, 0.15)).toBe(1);
    expect(presence(4.1, 4, 0.2, 0.15)).toBe(0);
  });

  it("leaves faster than it arrives", () => {
    const arriving = presence(0.05, 4, 0.2, 0.15);
    const leaving = presence(4 - 0.05, 4, 0.2, 0.15);
    expect(arriving).toBeGreaterThan(0);
    expect(arriving).toBeLessThan(1);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(1);
  });

  it("cuts in when the enter time is zero", () => {
    expect(presence(0, 4, 0, 0)).toBe(1);
  });
});
