import { describe, expect, it } from "vitest";
import { captionTimelineRange, generateCaptions } from "@/lib/studio/captions";
import type { Caption, Clip, MediaRef, Word } from "@/lib/studio/types";

const asset = (url = "asset.mp4", duration = 10): MediaRef => ({
  url,
  kind: "video",
  name: url,
  duration,
});

/** A slice of the project's recording. */
const rec = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
});

/** A clip carrying its own media, appended alongside the recording. */
const appended = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
  src: asset(),
});

/** One word per second: `word(0, "hi")` spans source 0.0 to 0.9. */
const word = (start: number, text: string, len = 0.9): Word => ({
  id: `w-${start}`,
  text,
  start,
  end: start + len,
});

const caption = (
  sourceStart: number,
  sourceEnd: number,
  text: string,
): Caption => ({ id: `c-${sourceStart}`, text, sourceStart, sourceEnd });

describe("generateCaptions", () => {
  it("drops words whose source second was cut", () => {
    const clips = [rec("a", 0, 2), rec("b", 4, 6)];
    const words = [word(0, "kept"), word(2.5, "cut"), word(4, "also")];
    const out = generateCaptions(words, clips);
    expect(out.map((c) => c.text).join(" ")).not.toContain("cut");
  });

  it("keeps no words when the recording is gone, whatever the appended clips span", () => {
    // The appended clip's own seconds run 0..4. A word at recording second 1
    // must not be reported as kept just because that number lands inside them.
    const out = generateCaptions([word(1, "orphan")], [appended("b", 0, 4)]);
    expect(out).toEqual([]);
  });

  it("measures the pause that breaks a caption in edited-timeline seconds", () => {
    // Two near-adjacent recording seconds, pushed 4s apart on the timeline by an
    // appended clip between them. The words are only 0.4s apart in the source,
    // so a source-time gap check would run them into a single caption.
    const clips = [rec("a", 0, 1), appended("b", 0, 4), rec("c", 1.2, 3)];
    const words = [word(0.2, "before", 0.6), word(1.2, "after")];
    const out = generateCaptions(words, clips);
    expect(out.map((c) => c.text)).toEqual(["before", "after"]);
  });

  it("groups words up to the character budget", () => {
    const clips = [rec("a", 0, 10)];
    const words = [word(0, "aaaa"), word(1, "bbbb"), word(2, "cccc")];
    const out = generateCaptions(words, clips, { maxChars: 9 });
    expect(out.map((c) => c.text)).toEqual(["aaaa bbbb", "cccc"]);
  });

  it("cuts at exactly maxWords words in word mode", () => {
    const clips = [rec("a", 0, 10)];
    const words = [word(0, "a"), word(1, "b"), word(2, "c"), word(3, "d")];
    const out = generateCaptions(words, clips, { maxWords: 2 });
    expect(out.map((c) => c.text)).toEqual(["a b", "c d"]);
  });

  it("leads into the gap before its first word, never over the previous word", () => {
    const clips = [rec("a", 0, 10)];
    const [lonely] = generateCaptions([word(1, "hi")], clips, { maxWords: 1 });
    // 1.0 minus the 0.12s lead.
    expect(lonely.sourceStart).toBeCloseTo(0.88, 5);

    const words = [word(0, "a", 0.95), word(1, "b")];
    const [, second] = generateCaptions(words, clips, { maxWords: 1 });
    // The lead would reach 0.88, which is still inside "a". Clamp to its end.
    expect(second.sourceStart).toBeCloseTo(0.95, 5);
  });
});

describe("captionTimelineRange", () => {
  it("shifts a caption by the appended clips that precede it", () => {
    const clips = [rec("a", 0, 3), appended("b", 0, 4), rec("c", 3, 10)];
    expect(captionTimelineRange(clips, caption(3.5, 4.5, "x"))).toEqual({
      start: 7.5,
      end: 8.5,
    });
  });

  it("collapses a caption that lives in a cut region", () => {
    const clips = [rec("a", 0, 3), rec("c", 6, 10)];
    const r = captionTimelineRange(clips, caption(4, 5, "gone"));
    expect(r.start).toBe(3);
    expect(r.end).toBe(3);
  });

  it("follows a reordered clip", () => {
    // The user dragged the recording's second half in front of its first half.
    // Source second 1 now plays at timeline 6, not 0.
    const clips = [rec("b", 5, 10), rec("a", 0, 5)];
    expect(captionTimelineRange(clips, caption(1, 2, "late"))).toEqual({
      start: 6,
      end: 7,
    });
    expect(captionTimelineRange(clips, caption(6, 7, "early"))).toEqual({
      start: 1,
      end: 2,
    });
  });
});
