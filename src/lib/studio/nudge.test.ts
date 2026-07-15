import { describe, expect, it } from "vitest";
import { nudgeDelta, nudgeRect } from "@/lib/studio/nudge";
import type { OverlayRect } from "@/lib/studio/types";

const box = (x: number, y: number, w: number, h: number): OverlayRect => ({
  x,
  y,
  w,
  h,
});

describe("nudgeDelta", () => {
  it("maps each arrow to a screen-space direction", () => {
    expect(nudgeDelta("ArrowLeft")).toEqual({ dx: -1, dy: 0 });
    expect(nudgeDelta("ArrowRight")).toEqual({ dx: 1, dy: 0 });
    expect(nudgeDelta("ArrowUp")).toEqual({ dx: 0, dy: -1 });
    expect(nudgeDelta("ArrowDown")).toEqual({ dx: 0, dy: 1 });
  });

  it("returns null for any non-arrow key", () => {
    expect(nudgeDelta("a")).toBeNull();
    expect(nudgeDelta("Enter")).toBeNull();
    expect(nudgeDelta(" ")).toBeNull();
  });
});

describe("nudgeRect", () => {
  const b = box(0.4, 0.4, 0.2, 0.2);

  it("shifts position by dx/dy times the step", () => {
    expect(nudgeRect(b, 1, 0, 0.005).x).toBeCloseTo(0.405, 6);
    expect(nudgeRect(b, -1, 0, 0.005).x).toBeCloseTo(0.395, 6);
    expect(nudgeRect(b, 0, -1, 0.005).y).toBeCloseTo(0.395, 6);
    expect(nudgeRect(b, 0, 1, 0.005).y).toBeCloseTo(0.405, 6);
  });

  it("never leaves the size behind", () => {
    const r = nudgeRect(b, 1, 1, 0.02);
    expect(r.w).toBe(0.2);
    expect(r.h).toBe(0.2);
  });

  it("stops the far edge at the stage's right/bottom", () => {
    // Box at x 0.79 (right edge 0.99); a 0.05 nudge right would push it off, so
    // x clamps to 1 - w = 0.8.
    const r = nudgeRect(box(0.79, 0.79, 0.2, 0.2), 1, 1, 0.05);
    expect(r.x).toBeCloseTo(0.8, 6);
    expect(r.y).toBeCloseTo(0.8, 6);
  });

  it("stops the near edge at the stage's left/top", () => {
    const r = nudgeRect(box(0.02, 0.02, 0.2, 0.2), -1, -1, 0.05);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});
