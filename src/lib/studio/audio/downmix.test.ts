import { describe, expect, it } from "vitest";
import { downmixMono } from "@/lib/studio/audio/downmix";

describe("downmixMono", () => {
  it("passes a single channel through unchanged", () => {
    const mono = new Float32Array([0.1, -0.2, 0.3]);
    expect(downmixMono([mono])).toBe(mono);
  });

  it("averages stereo channels sample by sample", () => {
    const left = new Float32Array([1, 0, -1]);
    const right = new Float32Array([0, 0, 0]);
    expect(Array.from(downmixMono([left, right]))).toEqual([0.5, 0, -0.5]);
  });

  it("averages across more than two channels", () => {
    const out = downmixMono([
      new Float32Array([3, 6]),
      new Float32Array([0, 0]),
      new Float32Array([0, 3]),
    ]);
    expect(Array.from(out)).toEqual([1, 3]); // [3/3, 9/3]
  });

  it("treats a channel that ends early as silence, sized to the first", () => {
    const out = downmixMono([
      new Float32Array([2, 2, 2]),
      new Float32Array([2, 2]), // one short
    ]);
    expect(Array.from(out)).toEqual([2, 2, 1]); // last sample: (2 + 0) / 2
  });

  it("returns an empty buffer for no channels", () => {
    expect(downmixMono([]).length).toBe(0);
  });
});
