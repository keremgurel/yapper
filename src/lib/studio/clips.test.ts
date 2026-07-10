import { describe, expect, it } from "vitest";
import {
  removeSourceRange,
  restoreSourceRange,
  splitClipAt,
  timelineToClip,
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
