import { describe, expect, it } from "vitest";
import {
  dropSlivers,
  fillerCuts,
  pauseCuts,
  trimClipsToSpeech,
} from "@/lib/studio/auto-edit";
import type { TrimAnalysis } from "@/lib/studio/silence";
import type { Clip, Word } from "@/lib/studio/types";

/** A word spanning source seconds [start, end]. */
const word = (start: number, end: number, text = "word"): Word => ({
  id: `w-${start}`,
  text,
  start,
  end,
});

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

describe("pauseCuts", () => {
  const opts = { minGap: 0.4, minSilence: 0.5, headPad: 0.05, tailPad: 0.1 };

  it("cuts the gap between two words when it is long enough", () => {
    const w = [word(0, 1), word(2, 3)]; // 1s gap
    expect(pauseCuts(w, 3, opts)).toEqual([[1, 2]]);
  });

  it("leaves a gap shorter than minGap alone", () => {
    const w = [word(0, 1), word(1.3, 2)]; // 0.3s gap
    expect(pauseCuts(w, 2, opts)).toEqual([]);
  });

  it("cuts the silence before the first word, keeping a little padding", () => {
    const w = [word(2, 3)];
    expect(pauseCuts(w, 3, opts)).toEqual([[0, 1.95]]);
  });

  it("cuts the silence after the last word, keeping a little padding", () => {
    const w = [word(0, 1)];
    expect(pauseCuts(w, 3, opts)).toEqual([[1.1, 3]]);
  });

  it("leaves head and tail silence alone when there is barely any", () => {
    const w = [word(0.2, 1)]; // 0.2s head, 0.3s tail: both under minSilence
    expect(pauseCuts(w, 1.3, opts)).toEqual([]);
  });

  it("takes its thresholds from the caller, since the two callers differ", () => {
    const w = [word(0.45, 1)];
    // Auto-edit is more aggressive: it cuts a head this short, removePauses doesn't.
    expect(pauseCuts(w, 1, opts)).toEqual([]);
    const [[from, to]] = pauseCuts(w, 1, {
      minGap: 0.25,
      minSilence: 0.4,
      headPad: 0.04,
      tailPad: 0.15,
    });
    expect(from).toBe(0);
    expect(to).toBeCloseTo(0.41, 5);
  });

  it("returns nothing for an empty transcript", () => {
    expect(pauseCuts([], 10, opts)).toEqual([]);
  });
});

describe("fillerCuts", () => {
  it("cuts filler words and nothing else", () => {
    const w = [word(0, 1, "so"), word(1, 2, "um"), word(2, 3, "yes")];
    expect(fillerCuts(w)).toEqual([[1, 2]]);
  });

  it("merges a run of adjacent fillers into one range", () => {
    const w = [word(0, 1, "um"), word(1, 2, "uh"), word(2, 3, "yes")];
    expect(fillerCuts(w)).toEqual([[0, 2]]);
  });

  it("returns nothing when nobody hesitates", () => {
    expect(fillerCuts([word(0, 1, "hello")])).toEqual([]);
  });
});

describe("dropSlivers", () => {
  it("drops clips too short to play cleanly", () => {
    const keep = rec(0, 1);
    expect(dropSlivers([keep, rec(1, 1.05)], 0.08)).toEqual([keep]);
  });

  it("keeps a clip exactly at the threshold", () => {
    expect(dropSlivers([rec(0, 0.08)], 0.08)).toHaveLength(1);
  });

  it("judges an appended clip by its own length, like any other", () => {
    expect(dropSlivers([appended(0, 0.01)], 0.08)).toEqual([]);
  });
});
