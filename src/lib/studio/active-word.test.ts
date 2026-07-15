import { describe, expect, it } from "vitest";
import { activeWordId } from "@/lib/studio/active-word";
import type { Clip, Word } from "@/lib/studio/types";

const rec = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
});

const appended = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
  src: { url: "b-roll.mp4", kind: "video", name: "b-roll.mp4", duration: 10 },
});

const word = (id: string, start: number, end: number): Word => ({
  id,
  text: id,
  start,
  end,
});

describe("activeWordId", () => {
  const words = [word("w0", 0, 1), word("w1", 1, 2), word("w7", 7, 8)];

  it("finds the word at the recording second under the playhead, past cuts", () => {
    // Recording [0,3] then [6,10]: edited second 4 is recording second 7.
    const clips = [rec("a", 0, 3), rec("b", 6, 10)];
    expect(activeWordId(words, clips, 4)).toBe("w7");
    expect(activeWordId(words, clips, 0.5)).toBe("w0");
  });

  it("holds the recording cut word while a b-roll plays, not a coincidental one", () => {
    // Base [0,1], a 4s b-roll over edited [1,5], then base resuming at rec 1.
    // Edited 4.5 sits inside the b-roll: the correct mapping clamps to the cut
    // (recording second 1, inside w1), while the raw edited time 4.5 lands on
    // no word at all. So this asserts the timeline-to-source mapping is used.
    const clips = [rec("a", 0, 1), appended("b", 0, 4), rec("c", 1, 10)];
    expect(activeWordId(words, clips, 4.5)).toBe("w1");
  });

  it("returns null when no word covers the mapped second", () => {
    const clips = [rec("a", 0, 10)];
    expect(activeWordId(words, clips, 5)).toBeNull(); // second 5, no word there
  });

  it("lets the later word win when timings overlap", () => {
    const clips = [rec("a", 0, 10)];
    const overlap = [word("early", 2, 4), word("late", 3, 5)];
    expect(activeWordId(overlap, clips, 3.5)).toBe("late");
  });
});
