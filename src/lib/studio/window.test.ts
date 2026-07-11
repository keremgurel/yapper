import { describe, expect, it } from "vitest";
import { visibleSpan } from "@/lib/studio/window";

// A clip sitting at timeline 10..20, showing source seconds 100..200 (so its
// media plays at 10x). 2 px per timeline second.
const clip = (visStart: number, visEnd: number) =>
  visibleSpan(10, 10, 100, 200, visStart, visEnd, 2);

describe("visibleSpan", () => {
  it("returns the whole clip when it is fully on screen", () => {
    expect(clip(0, 30)).toEqual({
      leftPx: 0,
      widthPx: 20,
      srcA: 100,
      srcB: 200,
    });
  });

  it("clips the left edge against the window, and maps it back to source", () => {
    // The window starts 5s into the clip: half of it, so source 150..200.
    expect(clip(15, 30)).toEqual({
      leftPx: 10,
      widthPx: 10,
      srcA: 150,
      srcB: 200,
    });
  });

  it("clips the right edge against the window", () => {
    expect(clip(0, 12)).toEqual({
      leftPx: 0,
      widthPx: 4,
      srcA: 100,
      srcB: 120,
    });
  });

  it("clips both edges at once", () => {
    expect(clip(12, 18)).toEqual({
      leftPx: 4,
      widthPx: 12,
      srcA: 120,
      srcB: 180,
    });
  });

  it("returns null for a clip entirely off screen", () => {
    expect(clip(0, 5)).toBeNull(); // window ends before the clip starts
    expect(clip(25, 30)).toBeNull(); // window starts after the clip ends
  });

  it("returns null when the clip only touches the window edge", () => {
    // Zero visible width would render an empty filmstrip, not nothing.
    expect(clip(20, 30)).toBeNull();
    expect(clip(0, 10)).toBeNull();
  });

  it("returns null for a zero-length clip", () => {
    expect(visibleSpan(10, 0, 100, 100, 0, 30, 2)).toBeNull();
  });

  it("leaves source seconds alone for a clip that plays at 1x", () => {
    expect(visibleSpan(0, 10, 4, 14, 2, 6, 1)).toEqual({
      leftPx: 2,
      widthPx: 4,
      srcA: 6,
      srcB: 10,
    });
  });

  it("scales pixels by pxPerSec, independent of the source range", () => {
    const a = visibleSpan(0, 10, 0, 10, 0, 10, 1);
    const b = visibleSpan(0, 10, 0, 10, 0, 10, 50);
    expect(a?.widthPx).toBe(10);
    expect(b?.widthPx).toBe(500);
    expect(a?.srcB).toBe(b?.srcB);
  });
});
