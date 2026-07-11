import { describe, expect, it } from "vitest";
import {
  AUTO_EDIT_STEPS,
  dropSlivers,
  fillerCuts,
  pauseCuts,
  planAutoEdit,
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

describe("planAutoEdit", () => {
  /** No analysis, no ai cuts: only the transcript drives the pass. */
  const plan = (over: Partial<Parameters<typeof planAutoEdit>[0]> = {}) =>
    planAutoEdit({
      clips: [rec(0, 10)],
      words: [],
      sourceDuration: 10,
      audioDuration: 10,
      analysis: null,
      aiCuts: null,
      ...over,
    });

  describe("the take's true length", () => {
    it("believes the audio over the video element", () => {
      expect(plan({ sourceDuration: 10, audioDuration: 12 }).duration).toBe(12);
    });

    it("stretches an untouched timeline to reach the audio's end", () => {
      const { clips } = plan({
        clips: [rec(0, 10)],
        sourceDuration: 10,
        audioDuration: 12,
      });
      expect(clips).toEqual([expect.objectContaining({ start: 0, end: 12 })]);
    });

    it("leaves an edited timeline alone rather than throwing the edit away", () => {
      const edited = [rec(0, 3), rec(5, 10)];
      const { clips } = plan({
        clips: edited,
        sourceDuration: 10,
        audioDuration: 12,
      });
      expect(clips).toEqual(edited);
    });

    it("does not stretch when the video was telling the truth", () => {
      const { clips, duration } = plan({
        sourceDuration: 10,
        audioDuration: 10,
      });
      expect(duration).toBe(10);
      expect(clips).toEqual([rec(0, 10)]);
    });
  });

  describe("cuts", () => {
    it("cuts filler words out of the timeline", () => {
      const { clips } = plan({
        words: [word(0, 1, "hello"), word(1, 2, "um"), word(2, 3, "world")],
      });
      // The "um" second is gone, and so is the dead air after the last word.
      expect(clips.map((c) => [c.start, c.end])).toEqual([
        [0, 1],
        [2, 3.15],
      ]);
    });

    it("cuts a long pause between two words", () => {
      const { clips } = plan({
        clips: [rec(0, 5)],
        sourceDuration: 5,
        audioDuration: 5,
        words: [word(0, 1), word(3, 4)],
      });
      // The pause is gone, and the tail silence after the last word with it.
      expect(clips.map((c) => [c.start, c.end])).toEqual([
        [0, 1],
        [3, 4.15],
      ]);
    });

    it("cuts the retakes the AI flags, by word index", () => {
      // "one two" then "one two" again: the AI marks words 0..1 as an earlier take.
      const words = [
        word(0, 1, "one"),
        word(1, 2, "two"),
        word(2, 3, "one"),
        word(3, 4, "two"),
      ];
      const { clips } = plan({
        clips: [rec(0, 4)],
        sourceDuration: 4,
        audioDuration: 4,
        words,
        aiCuts: [[0, 1]],
      });
      expect(clips.map((c) => [c.start, c.end])).toEqual([[2, 4]]);
    });

    it("does nothing to the clips when there is no transcript", () => {
      expect(plan({ words: [] }).clips).toEqual([rec(0, 10)]);
    });
  });

  describe("trimming", () => {
    it("trims clips to speech when the waveform was analysed", () => {
      const { clips } = plan({ analysis });
      expect(clips[0].start).toBeCloseTo(1.95, 5);
      expect(clips[0].end).toBeCloseTo(5.08, 5);
    });

    it("leaves clips untrimmed when the waveform could not be analysed", () => {
      expect(plan({ analysis: null }).clips).toEqual([rec(0, 10)]);
    });

    it("never trims an appended clip against the recording's waveform", () => {
      const broll = appended(0, 4);
      const { clips } = plan({ clips: [broll], analysis });
      expect(clips[0]).toBe(broll);
    });

    it("drops the slivers the cuts leave behind", () => {
      // A 0.02s clip is shorter than MIN_CLIP_SEC and would stutter.
      const { clips } = plan({ clips: [rec(0, 0.02), rec(1, 5)] });
      expect(clips).toEqual([rec(1, 5)]);
    });

    it("hands the take back rather than an empty timeline", () => {
      // Every clip is a sliver, so the pass would otherwise cut everything.
      const slivers = [rec(0, 0.01), rec(1, 1.01)];
      expect(plan({ clips: slivers }).clips).toBe(slivers);
    });
  });

  describe("progress", () => {
    it("reports the stages it runs, in order", () => {
      const steps: number[] = [];
      plan({ words: [word(0, 1)], onStep: (s) => steps.push(s) });
      expect(steps).toEqual([
        AUTO_EDIT_STEPS.RETAKES,
        AUTO_EDIT_STEPS.SILENCE,
        AUTO_EDIT_STEPS.TRIM,
      ]);
    });

    it("skips the transcript stages when there is no transcript", () => {
      const steps: number[] = [];
      plan({ words: [], onStep: (s) => steps.push(s) });
      expect(steps).toEqual([AUTO_EDIT_STEPS.TRIM]);
    });
  });
});
