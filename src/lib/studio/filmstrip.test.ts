import { describe, expect, it } from "vitest";
import { normalizePeaks } from "@/lib/studio/filmstrip";

describe("normalizePeaks", () => {
  it("scales by the loudest peak", () => {
    expect(normalizePeaks([0.25, 0.5, 1])).toEqual([0.25, 0.5, 1]);
    expect(normalizePeaks([1, 2, 4])).toEqual([0.25, 0.5, 1]);
  });

  it("floors the divisor so a near-silent clip doesn't explode to ~1s", () => {
    // Loudest is 0.002, but the 0.01 floor keeps peaks small instead of 1.0.
    expect(normalizePeaks([0.001, 0.002])).toEqual([0.1, 0.2]);
  });

  it("returns [] for empty input", () => {
    expect(normalizePeaks([])).toEqual([]);
  });

  it("handles tens of thousands of buckets without an argument-limit overflow", () => {
    // The old `Math.max(0.01, ...out)` threw a RangeError on arrays this large
    // on lower-limit engines, silently dropping the waveform for long clips.
    const big = new Array(200_000).fill(0.5);
    const out = normalizePeaks(big);
    expect(out.length).toBe(200_000);
    expect(out[0]).toBe(1); // 0.5 / 0.5
  });
});
