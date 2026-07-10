import { describe, expect, it } from "vitest";
import { trimClipsToSpeech } from "@/lib/studio/auto-edit";
import type { TrimAnalysis } from "@/lib/studio/silence";
import type { Clip } from "@/lib/studio/types";

/**
 * Ten seconds of recording at 10 frames a second. Everything is silent (-1)
 * except a block of speech (+1) from 2.0s up to 5.0s.
 */
const analysis: TrimAnalysis = {
  frameSec: 0.1,
  threshold: 0,
  db: Array.from({ length: 100 }, (_, i) => (i >= 20 && i < 50 ? 1 : -1)),
};

const rec = (start: number, end: number): Clip => ({ id: "r", start, end });

const appended = (start: number, end: number): Clip => ({
  id: "a",
  start,
  end,
  src: { url: "b-roll.mp4", kind: "video", name: "b-roll.mp4", duration: 10 },
});

describe("trimClipsToSpeech", () => {
  it("pulls a clip's edges in to the speech, with a little padding", () => {
    const [out] = trimClipsToSpeech([rec(0, 10)], analysis);
    expect(out.start).toBeCloseTo(1.95, 5); // 2.0 minus the lead pad
    expect(out.end).toBeCloseTo(5.08, 5); // 5.0 plus the tail pad
  });

  it("never widens a clip past the edges it already has", () => {
    const [out] = trimClipsToSpeech([rec(3, 4)], analysis);
    expect(out).toEqual(rec(3, 4));
  });

  it("leaves a clip that holds no speech alone", () => {
    const clip = rec(6, 9);
    expect(trimClipsToSpeech([clip], analysis)[0]).toBe(clip);
  });

  it("returns an already-tight clip by identity, so callers can count changes", () => {
    const clip = rec(1.95, 5.08);
    expect(trimClipsToSpeech([clip], analysis)[0]).toBe(clip);
  });

  it("leaves a clip alone when trimming would leave almost nothing", () => {
    // Speech covers only the last 0.05s of this clip.
    const clip = rec(1.9, 2.05);
    expect(trimClipsToSpeech([clip], analysis)[0]).toBe(clip);
  });

  it("does not touch a clip carrying its own media", () => {
    // The analysis is of the recording. This clip's 0..10 are seconds into
    // b-roll.mp4, so trimming them against the recording's speech would cut
    // unrelated footage to wherever the speaker paused.
    const clip = appended(0, 10);
    expect(trimClipsToSpeech([clip], analysis)[0]).toBe(clip);
  });

  it("trims the recording's clips while leaving appended ones between them", () => {
    const broll = appended(0, 4);
    const out = trimClipsToSpeech([rec(0, 10), broll, rec(0, 10)], analysis);
    expect(out[0].start).toBeCloseTo(1.95, 5);
    expect(out[1]).toBe(broll);
    expect(out[2].start).toBeCloseTo(1.95, 5);
  });

  it("keeps the clips in order and returns one output per input", () => {
    const clips = [rec(0, 10), appended(0, 4)];
    expect(trimClipsToSpeech(clips, analysis)).toHaveLength(2);
  });
});
