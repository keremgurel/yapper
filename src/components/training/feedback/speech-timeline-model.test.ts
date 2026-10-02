import { describe, expect, it } from "vitest";
import { buildSpeechTimeline } from "./speech-timeline-model";

const word = (text: string, start: number, end: number) => ({
  text,
  start,
  end,
});

describe("speech timeline", () => {
  it("splits speech at pauses and marks where each pause fell", () => {
    const model = buildSpeechTimeline([
      word("I", 0, 0.2),
      word("think", 0.25, 0.6),
      // 0.9s of silence after an unfinished thought
      word("it", 1.5, 1.7),
      word("works.", 1.75, 2.1),
      // 2s of silence after a finished sentence
      word("Done.", 4.1, 4.5),
    ])!;
    expect(model.durationSec).toBeCloseTo(4.5);
    expect(model.speech).toHaveLength(3);
    expect(model.pauses.map((p) => [p.midSentence, p.long, p.seconds])).toEqual(
      [
        [true, false, 0.9],
        [false, true, 2],
      ],
    );
    // Speech and pauses tile the whole line.
    const covered = [...model.speech, ...model.pauses].reduce(
      (sum, span) => sum + span.width,
      0,
    );
    expect(covered).toBeCloseTo(1);
  });
  it("places fillers, including two-word ones, on the line", () => {
    const model = buildSpeechTimeline([
      word("Um,", 0, 0.3),
      word("you", 0.35, 0.5),
      word("know", 0.55, 0.8),
      word("yes.", 0.85, 1),
    ])!;
    expect(model.fillers.map((f) => f.word)).toEqual(["um", "you know"]);
    expect(model.fillers[0].at).toBeLessThan(model.fillers[1].at);
  });
  it("draws nothing without timings", () => {
    expect(buildSpeechTimeline([])).toBeNull();
    expect(buildSpeechTimeline([word("Hi", 0, 0)])).toBeNull();
  });
});
