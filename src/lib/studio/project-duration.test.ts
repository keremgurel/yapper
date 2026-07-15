import { describe, expect, it } from "vitest";
import { projectDuration } from "./project-duration";
import type { AudioTrack, Clip, Overlay } from "./types";

const clip = (start: number, end: number): Clip => ({
  id: `c${start}-${end}`,
  start,
  end,
});

function overlay(fields: Partial<Overlay>): Overlay {
  return {
    id: "o",
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

function audio(fields: Partial<AudioTrack>): AudioTrack {
  return {
    id: "a",
    name: "track",
    url: "blob:a",
    duration: 0,
    start: 0,
    muted: false,
    ...fields,
  };
}

describe("projectDuration", () => {
  it("is the longest of the base clips, overlays, and audio tracks", () => {
    // Base clips play back to back: durations sum (5 + 3 = 8).
    const clips = [clip(0, 5), clip(2, 5)];
    expect(projectDuration(clips, [], [])).toBe(8);
    expect(
      projectDuration(clips, [overlay({ start: 6, duration: 5 })], []),
    ).toBe(11);
    expect(
      projectDuration(clips, [], [audio({ start: 0, duration: 10 })]),
    ).toBe(10);
  });

  it("keeps working with no base track", () => {
    expect(projectDuration([], [overlay({ start: 2, duration: 3 })], [])).toBe(
      5,
    );
  });

  it("ignores a hidden overlay so it can't pad trailing empty frames", () => {
    const clips = [clip(0, 8)];
    expect(
      projectDuration(
        clips,
        [overlay({ start: 0, duration: 20, hidden: true })],
        [],
      ),
    ).toBe(8);
    // A visible overlay of the same length still extends it.
    expect(
      projectDuration(clips, [overlay({ start: 0, duration: 20 })], []),
    ).toBe(20);
  });

  it("still counts a muted (but visible) overlay, since it renders", () => {
    expect(
      projectDuration(
        [clip(0, 4)],
        [overlay({ start: 0, duration: 15, muted: true })],
        [],
      ),
    ).toBe(15);
  });
});
