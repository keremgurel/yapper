import { describe, expect, it } from "vitest";
import {
  clipIndexAtSource,
  removeSourceRange,
  restoreSourceRange,
  sourceToTimeline,
  sourceToTimelineSeq,
  splitClipAt,
  timelineToClip,
  timelineToSource,
  totalDuration,
  trimBounds,
} from "@/lib/studio/clips";
import type { Clip, MediaRef } from "@/lib/studio/types";

const asset = (url: string, duration = 10): MediaRef => ({
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
const appended = (
  id: string,
  start: number,
  end: number,
  url = "asset.mp4",
): Clip => ({ id, start, end, src: asset(url) });

describe("removeSourceRange", () => {
  it("cuts the range out of a recording clip", () => {
    const out = removeSourceRange([rec("a", 0, 10)], 4, 6);
    expect(out.map((c) => [c.start, c.end])).toEqual([
      [0, 4],
      [6, 10],
    ]);
  });

  it("drops a recording clip fully inside the range", () => {
    expect(removeSourceRange([rec("a", 4, 6)], 0, 10)).toEqual([]);
  });

  it("leaves appended clips untouched", () => {
    // The range is the RECORDING's timeline. An appended clip's start/end are
    // seconds into its own media, so they must not be compared against it.
    const clips = [rec("a", 0, 10), appended("b", 0, 10)];
    const out = removeSourceRange(clips, 4, 6);
    expect(out.filter((c) => c.src)).toEqual([appended("b", 0, 10)]);
  });

  it("keeps an appended clip's position among the recording's clips", () => {
    const clips = [rec("a", 0, 10), appended("b", 0, 4), rec("c", 10, 20)];
    const out = removeSourceRange(clips, 2, 8);
    // The recording clip splits in two; the appended clip stays put behind it.
    expect(out.map((c) => [c.start, c.end])).toEqual([
      [0, 2],
      [8, 10],
      [0, 4],
      [10, 20],
    ]);
    expect(out[2]).toEqual(appended("b", 0, 4));
    expect(out[3]).toEqual(rec("c", 10, 20));
  });

  it("preserves clip.src when it splits an appended clip's neighbour", () => {
    const out = removeSourceRange([appended("b", 0, 10)], 4, 6);
    expect(out).toEqual([appended("b", 0, 10)]);
  });
});

describe("restoreSourceRange", () => {
  it("merges a restored range back into adjacent recording clips", () => {
    const clips = [rec("a", 0, 4), rec("b", 6, 10)];
    const out = restoreSourceRange(clips, 4, 6);
    expect(out.map((c) => [c.start, c.end])).toEqual([[0, 10]]);
  });

  it("does not merge clips that share a range but not a source", () => {
    const clips = [rec("a", 0, 4), appended("b", 4, 8)];
    const out = restoreSourceRange(clips, 4, 6);
    expect(out.filter((c) => c.src)).toHaveLength(1);
  });

  it("does not reorder appended clips", () => {
    // Appended clips have their own timebase; sorting everything by `start`
    // would yank them to the front of the sequence.
    const clips = [rec("a", 6, 10), appended("b", 0, 5)];
    const out = restoreSourceRange(clips, 0, 4);
    const appendedIndex = out.findIndex((c) => c.src);
    expect(appendedIndex).toBe(out.length - 1);
  });
});

describe("splitClipAt", () => {
  it("splits the clip under the playhead, not one with a matching source time", () => {
    // Both clips cover source seconds 0..5, but they are different footage.
    const clips = [appended("b", 0, 5), rec("a", 0, 5)];
    const out = splitClipAt(clips, 7); // 2s into the recording clip
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual(appended("b", 0, 5));
    expect([out[1].start, out[1].end]).toEqual([0, 2]);
    expect([out[2].start, out[2].end]).toEqual([2, 5]);
  });

  it("carries clip.src across a split", () => {
    const out = splitClipAt([appended("b", 0, 10)], 4);
    expect(out).toHaveLength(2);
    expect(out.every((c) => c.src?.url === "asset.mp4")).toBe(true);
  });

  it("refuses to split at a clip boundary", () => {
    const clips = [rec("a", 0, 5), rec("b", 5, 10)];
    expect(splitClipAt(clips, 5)).toEqual(clips);
    expect(splitClipAt(clips, 0)).toEqual(clips);
  });
});

describe("trimBounds", () => {
  it("fences a recording clip against its recording neighbours", () => {
    const clips = [rec("a", 0, 4), rec("b", 6, 10), rec("c", 12, 20)];
    expect(trimBounds(clips, 1, 30)).toEqual({ min: 4, max: 12 });
  });

  it("gives an appended clip its own media's full length", () => {
    const clips = [rec("a", 0, 4), appended("b", 1, 3), rec("c", 12, 20)];
    expect(trimBounds(clips, 1, 30)).toEqual({ min: 0, max: 10 });
  });
});

describe("timelineToClip", () => {
  it("maps a timeline position onto the clip playing there", () => {
    const clips = [rec("a", 5, 10), rec("b", 0, 2)];
    expect(timelineToClip(clips, 1)).toEqual({ index: 0, sourceTime: 6 });
    expect(timelineToClip(clips, 6)).toEqual({ index: 1, sourceTime: 1 });
  });

  it("never resolves past a clip's own out-point", () => {
    const clips = [rec("a", 0, 5)];
    expect(timelineToClip(clips, 5.01)?.sourceTime).toBeLessThanOrEqual(5);
  });

  it("returns null for an empty bottom track", () => {
    expect(timelineToClip([], 0)).toBeNull();
  });
});

describe("totalDuration", () => {
  it("sums clip lengths regardless of which media they read", () => {
    expect(totalDuration([rec("a", 0, 4), appended("b", 2, 5)])).toBe(7);
  });
});

// The recording is split around an appended clip: the bottom track plays
// rec 0..3, then 4s of other footage, then rec 3..10. So the edited timeline is
//   tl 0..3  = recording 0..3
//   tl 3..7  = the appended clip (no recording second exists here)
//   tl 7..14 = recording 3..10
const splitAroundAppended = (): Clip[] => [
  rec("a", 0, 3),
  appended("b", 0, 4),
  rec("c", 3, 10),
];

describe("sourceToTimeline", () => {
  it("maps a recording second before the appended clip", () => {
    expect(sourceToTimeline(splitAroundAppended(), 2)).toBe(2);
  });

  it("skips over an appended clip's own timebase", () => {
    // Recording second 3.5 plays at tl 7.5, after the 4s appended clip. Reading
    // 3.5 as an offset into the appended clip's 0..4 range would say 6.5.
    expect(sourceToTimeline(splitAroundAppended(), 3.5)).toBe(7.5);
  });

  it("does not stop early at an appended clip that starts late", () => {
    // A trimmed appended clip (its media's seconds 5..9) must not swallow the
    // lookup just because the recording second is below its `start`.
    const clips = [rec("a", 0, 4), appended("b", 5, 9), rec("c", 4, 10)];
    expect(sourceToTimeline(clips, 4.5)).toBe(8.5);
  });

  it("maps a cut recording second to the cut point", () => {
    const clips = [rec("a", 0, 3), rec("c", 6, 10)];
    expect(sourceToTimeline(clips, 4)).toBe(3);
  });

  it("follows reordered recording clips", () => {
    // The recording's second half was dragged in front of its first half, so
    // source second 1 now plays at timeline 6.
    const clips = [rec("b", 5, 10), rec("a", 0, 5)];
    expect(sourceToTimeline(clips, 1)).toBe(6);
    expect(sourceToTimeline(clips, 6)).toBe(1);
  });

  it("maps a cut second to the nearest cut point under reordering", () => {
    // tl 0..2 = rec 8..10, tl 2..5 = rec 0..3. Source 4 was cut; it sits just
    // after the clip that ends at 3, which finishes at timeline 5.
    const clips = [rec("b", 8, 10), rec("a", 0, 3)];
    expect(sourceToTimeline(clips, 4)).toBe(5);
    // Source 7 was cut too, and is nearest the clip starting at 8, at timeline 0.
    expect(sourceToTimeline(clips, 7)).toBe(0);
  });

  it("returns 0 when no recording clip is left to anchor against", () => {
    expect(sourceToTimeline([appended("b", 0, 4)], 2)).toBe(0);
  });

  it("resolves a second two clips share to the first of them, as clipIndexAtSource does", () => {
    // rec 1.0 is both the out-point of one clip and the in-point of the next.
    const clips = [rec("a", 0, 1), appended("b", 0, 4), rec("c", 1, 2)];
    expect(clipIndexAtSource(clips, 1)).toBe(0);
    expect(sourceToTimeline(clips, 1)).toBe(1);
  });
});

describe("timelineToSource", () => {
  it("maps a position over the recording to its own second", () => {
    expect(timelineToSource(splitAroundAppended(), 8)).toBe(4);
  });

  it("clamps a position over an appended clip to the nearest recording second", () => {
    // tl 5 sits inside the appended clip. There is no recording second there,
    // so a caption dropped here anchors at the last recording moment: 3.
    expect(timelineToSource(splitAroundAppended(), 5)).toBe(3);
  });

  it("clamps to the first recording clip when the appended clip leads", () => {
    const clips = [appended("b", 0, 4), rec("a", 2, 10)];
    expect(timelineToSource(clips, 1)).toBe(2);
  });

  it("returns 0 for an empty bottom track", () => {
    expect(timelineToSource([], 3)).toBe(0);
  });
});

describe("clipIndexAtSource", () => {
  it("finds the recording clip holding a source second", () => {
    expect(clipIndexAtSource(splitAroundAppended(), 3.5)).toBe(2);
  });

  it("reports cut speech as cut, even when an appended clip spans that number", () => {
    // Recording second 3.5 was cut. The appended clip's 0..4 range must not be
    // mistaken for it, or the caption generator emits captions for cut words.
    const clips = [rec("a", 0, 3), appended("b", 0, 4)];
    expect(clipIndexAtSource(clips, 3.5)).toBe(-1);
  });
});

describe("sourceToTimelineSeq", () => {
  it("jumps to the recording clip holding the word, not an appended clip", () => {
    expect(sourceToTimelineSeq(splitAroundAppended(), 3.5)).toEqual({
      index: 2,
      timeline: 7.5,
    });
  });

  it("returns null when the source second is not on the timeline", () => {
    const clips = [rec("a", 0, 3), appended("b", 0, 8)];
    expect(sourceToTimelineSeq(clips, 5)).toBeNull();
  });
});
