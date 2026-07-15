import { describe, expect, it } from "vitest";
import { nearest, snapClipStart, timelineSnapPoints } from "@/lib/studio/snap";
import type { AudioTrack, Clip, Overlay } from "@/lib/studio/types";

const clip = (id: string, start: number, end: number): Clip => ({
  id,
  start,
  end,
});

function overlay(fields: Partial<Overlay> & { id: string }): Overlay {
  return {
    kind: "video",
    url: "blob:x",
    name: "clip",
    track: 0,
    start: 0,
    duration: 0,
    sourceStart: 0,
    ...fields,
  };
}

function audio(fields: Partial<AudioTrack> & { id: string }): AudioTrack {
  return {
    name: "track",
    url: "blob:a",
    duration: 0,
    start: 0,
    sourceStart: 0,
    mediaDuration: 3600,
    muted: false,
    ...fields,
  };
}

describe("timelineSnapPoints", () => {
  it("offers the project's ends and the playhead", () => {
    expect(timelineSnapPoints([], [], [], 30, 7)).toEqual([0, 30, 7]);
  });

  it("offers every seam in the bottom track", () => {
    // Two clips of 2s and 3s: seams at 2 and 5.
    const clips = [clip("a", 0, 2), clip("b", 4, 7)];
    expect(timelineSnapPoints(clips, [], [], 5, 0)).toEqual([0, 5, 0, 2, 5]);
  });

  it("measures a seam by the clip's length, not its source times", () => {
    // An appended clip's 100..102 are seconds into its own file. It still
    // occupies 2s of timeline, so the seam after it is at 2.
    const appended: Clip = {
      id: "b",
      start: 100,
      end: 102,
      src: { url: "b.mp4", kind: "video", name: "b.mp4", duration: 200 },
    };
    expect(timelineSnapPoints([appended], [], [], 2, 0)).toEqual([0, 2, 0, 2]);
  });

  it("offers both edges of every overlay and audio clip", () => {
    const overlays = [overlay({ id: "o", start: 3, duration: 2 })]; // edges 3, 5
    const audios = [audio({ id: "a", start: 8, duration: 4 })]; // edges 8, 12
    expect(timelineSnapPoints([], overlays, audios, 20, 0)).toEqual([
      0, 20, 0, 3, 5, 8, 12,
    ]);
  });

  it("excludes the dragged clip's own edges so it can't snap to itself", () => {
    const overlays = [
      overlay({ id: "self", start: 3, duration: 2 }),
      overlay({ id: "other", start: 9, duration: 1 }),
    ];
    // Only the other overlay's edges (9, 10) survive; self's 3 and 5 are gone.
    expect(timelineSnapPoints([], overlays, [], 20, 0, "self")).toEqual([
      0, 20, 0, 9, 10,
    ]);
  });

  it("ignores a hidden overlay, which is composited nowhere", () => {
    const overlays = [
      overlay({ id: "o", start: 3, duration: 2, hidden: true }),
    ];
    expect(timelineSnapPoints([], overlays, [], 20, 0)).toEqual([0, 20, 0]);
  });
});

describe("nearest", () => {
  it("returns v unchanged when nothing is within the threshold", () => {
    expect(nearest(5, [0, 9], 1)).toBe(5);
  });

  it("picks the closest in-range point, not the first one listed", () => {
    // Both 4 and 4.5 are within 1 of 4.4, but 4.5 is closer. First-wins would
    // wrongly return 4; this must return 4.5.
    expect(nearest(4.4, [4, 4.5], 1)).toBe(4.5);
    // Order must not matter: same points, first listed is the far one.
    expect(nearest(4.4, [4.5, 4], 1)).toBe(4.5);
  });

  it("does not snap at exactly the threshold", () => {
    expect(nearest(4.5, [4], 0.5)).toBe(4.5);
  });
});

describe("snapClipStart", () => {
  const points = [0, 10, 4]; // project start, project end, playhead

  it("leaves a start that is nowhere near a snap point", () => {
    expect(snapClipStart(6.5, 1, points, 0.1)).toBe(6.5);
  });

  it("pulls a nearby start onto the point", () => {
    expect(snapClipStart(4.05, 1, points, 0.1)).toBe(4);
  });

  it("pulls a nearby end onto the point, moving the whole clip", () => {
    // The clip runs 3.05..4.05; its END is what is near the playhead at 4.
    expect(snapClipStart(3.05, 1, points, 0.1)).toBe(3);
  });

  it("lets the start win when both edges are in range", () => {
    // start 3.95 is near the playhead at 4, so the clip goes to 4. Its end,
    // 10.05, is just as near the project end at 10, which would put the start
    // at 3.9 instead. The pointer holds the leading edge, so 4 wins.
    expect(snapClipStart(3.95, 6.1, points, 0.1)).toBe(4);
  });

  it("takes the nearest of several points in range", () => {
    expect(snapClipStart(4.4, 1, [4, 4.5, 6], 1)).toBe(4.5);
  });

  it("does not snap at exactly the threshold, but does just inside it", () => {
    // Exact halves, so the comparison is not at the mercy of float error.
    expect(snapClipStart(4.5, 1, [4], 0.5)).toBe(4.5);
    expect(snapClipStart(4.25, 1, [4], 0.5)).toBe(4);
  });

  it("never drags a clip before 0:00", () => {
    expect(snapClipStart(-5, 1, points, 0.1)).toBe(0);
  });

  it("clamps to 0:00 rather than letting an end-snap push it negative", () => {
    // Snapping the end onto 0 would put the start at -1.
    expect(snapClipStart(-0.98, 1, [0], 0.1)).toBe(0);
  });

  it("holds still when the start already sits exactly on a point", () => {
    expect(snapClipStart(4, 1, points, 0.1)).toBe(4);
  });
});
