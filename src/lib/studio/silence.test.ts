import { describe, expect, it } from "vitest";
import {
  analyzeForTrim,
  detectSpeechSegments,
  speechBoundsInRange,
} from "@/lib/studio/silence";

const SR = 16000;

/**
 * A mono 16 kHz buffer: near-silent everywhere, at full amplitude over the given
 * [startSec, endSec] spans. Loud and silent frames are ~70 dB apart, and every
 * boundary lands on a frame edge, so segment bounds are exact and deterministic.
 */
function makeAudio(
  totalSec: number,
  loud: [number, number][],
  amp = 0.3,
): Float32Array {
  const data = new Float32Array(Math.round(totalSec * SR));
  data.fill(1e-4);
  for (const [a, b] of loud) {
    const i0 = Math.round(a * SR);
    const i1 = Math.round(b * SR);
    for (let i = i0; i < i1; i++) data[i] = amp;
  }
  return data;
}

describe("detectSpeechSegments", () => {
  it("finds each spoken span and its silences between", () => {
    // Speech at [0.5,1.0] and [1.5,2.0], separated by a 0.5s gap (> the 0.35s
    // default minSilence), so the two stay distinct.
    const data = makeAudio(2.0, [
      [0.5, 1.0],
      [1.5, 2.0],
    ]);
    const segs = detectSpeechSegments(data);
    expect(segs).toHaveLength(2);
    expect(segs[0].start).toBeCloseTo(0.5, 2);
    expect(segs[0].end).toBeCloseTo(1.0, 2);
    expect(segs[1].start).toBeCloseTo(1.5, 2);
    expect(segs[1].end).toBeCloseTo(2.0, 2);
  });

  it("bridges a gap shorter than minSilence into one segment", () => {
    // Same audio, but a minSilence longer than the 0.5s gap folds the two spans
    // into a single spoken segment.
    const data = makeAudio(2.0, [
      [0.5, 1.0],
      [1.5, 2.0],
    ]);
    const segs = detectSpeechSegments(data, { minSilenceSec: 0.6 });
    expect(segs).toHaveLength(1);
    expect(segs[0].start).toBeCloseTo(0.5, 2);
    expect(segs[0].end).toBeCloseTo(2.0, 2);
  });

  it("does not guess when the noise-to-speech spread is too small to call", () => {
    // Background at 0.1 with slightly louder 0.15 blips: only ~3.5 dB of spread,
    // under the confidence floor. Without the guard the VAD would carve those
    // blips out as false speech; with it, the whole clip is kept as one span.
    const data = new Float32Array(Math.round(1.0 * SR)).fill(0.1);
    for (const [a, b] of [
      [0.3, 0.45],
      [0.6, 0.75],
    ] as const) {
      for (let i = Math.round(a * SR); i < Math.round(b * SR); i++)
        data[i] = 0.15;
    }
    const segs = detectSpeechSegments(data);
    expect(segs).toHaveLength(1);
    expect(segs[0].start).toBe(0);
    expect(segs[0].end).toBeCloseTo(1.0, 2);
  });
});

describe("speechBoundsInRange", () => {
  // Speech at [0.3,0.7] inside a 1s clip; the rest is silence.
  const data = makeAudio(1.0, [[0.3, 0.7]]);
  const analysis = analyzeForTrim(data);

  it("tightens onto the first and last speech in the range", () => {
    const bounds = speechBoundsInRange(analysis, 0, 1.0);
    expect(bounds).not.toBeNull();
    expect(bounds!.start).toBeCloseTo(0.3, 2);
    expect(bounds!.end).toBeCloseTo(0.7, 2);
  });

  it("returns null for a sub-range that holds no speech", () => {
    // The tail [0.7,1.0] is silent, so there is nothing to trim to.
    expect(speechBoundsInRange(analysis, 0.7, 1.0)).toBeNull();
  });
});
