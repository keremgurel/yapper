import { describe, expect, it } from "vitest";
import {
  ALIGN_SNAP,
  horizontalTargets,
  snapEdge,
  snapSpan,
  verticalTargets,
} from "@/lib/studio/align";
import type { OverlayRect } from "@/lib/studio/types";

const rect = (x: number, y: number, w: number, h: number): OverlayRect => ({
  x,
  y,
  w,
  h,
});

describe("verticalTargets / horizontalTargets", () => {
  it("always offers the stage edges and center", () => {
    expect(verticalTargets([])).toEqual([0, 0.5, 1]);
    expect(horizontalTargets([])).toEqual([0, 0.5, 1]);
  });

  it("adds each other overlay's near edge, center, and far edge", () => {
    // Eighths so the sums are binary-exact (no floating-point drift).
    const others = [rect(0.125, 0.125, 0.25, 0.25)];
    // near 0.125, center 0.125 + 0.25/2 = 0.25, far 0.125 + 0.25 = 0.375
    expect(verticalTargets(others)).toEqual([0, 0.5, 1, 0.125, 0.25, 0.375]);
    expect(horizontalTargets(others)).toEqual([0, 0.5, 1, 0.125, 0.25, 0.375]);
  });
});

describe("snapSpan", () => {
  const targets = [0, 0.5, 1];

  it("snaps the span's center onto a line just within range", () => {
    // A width-0.4 span whose center sits 0.01 left of stage center (< 0.012).
    // start 0.29 => center 0.49; delta to 0.5 is +0.01, landing the center on it.
    const snapped = snapSpan(0.29, 0.4, targets);
    expect(snapped).not.toBeNull();
    expect(snapped!.guide).toBe(0.5);
    expect(snapped!.delta).toBeCloseTo(0.01, 5);
  });

  it("snaps the start edge onto the stage's left edge", () => {
    // start 0.008 (< 0.012 from 0): the left edge pulls to 0, delta -0.008.
    const snapped = snapSpan(0.008, 0.3, targets);
    expect(snapped).not.toBeNull();
    expect(snapped!.guide).toBe(0);
    expect(snapped!.delta).toBeCloseTo(-0.008, 5);
  });

  it("returns null when no edge is within the snap distance", () => {
    // start 0.1, center 0.3, end 0.5... end lands exactly on 0.5. Shift off it.
    expect(snapSpan(0.1, 0.36, targets)).toBeNull();
  });

  it("prefers the globally closest line, not the first one in range", () => {
    // start 0.49 is within range of 0.498 (delta 0.008), which is met first; but
    // the span's center (0.5) sits exactly on 0.5, a closer pairing. The closest
    // must win, so the guide is 0.5, not the 0.498 encountered first.
    const snapped = snapSpan(0.49, 0.02, [0.498, 0.5]);
    expect(snapped).not.toBeNull();
    expect(snapped!.guide).toBe(0.5);
    expect(snapped!.delta).toBeCloseTo(0, 5);
  });
});

describe("snapEdge", () => {
  const targets = [0, 0.5, 1];

  it("returns the nearest target within range", () => {
    expect(snapEdge(0.505, targets)).toBe(0.5);
  });

  it("returns null when the nearest target is beyond the snap distance", () => {
    expect(snapEdge(0.52, targets)).toBeNull();
  });

  it("picks the closer of two in-range targets", () => {
    // 0.497 is nearer 0.5 than 0.49; both within ALIGN_SNAP of it.
    expect(snapEdge(0.497, [0.49, 0.5])).toBe(0.5);
  });

  it("treats a target exactly ALIGN_SNAP away as in range", () => {
    expect(snapEdge(ALIGN_SNAP, [0])).toBe(0);
  });
});
