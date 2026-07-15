import { describe, expect, it } from "vitest";
import { overlayToBaseClip } from "@/lib/studio/fold";
import type { Overlay, StudioSource } from "@/lib/studio/types";

const overlay = (over: Partial<Overlay> = {}): Overlay => ({
  id: "o1",
  kind: "video",
  url: "broll.mp4",
  name: "B-roll",
  track: 0,
  start: 0,
  duration: 3,
  sourceStart: 0,
  ...over,
});

const source: StudioSource = {
  url: "recording.webm",
  name: "Recording",
  duration: 60,
};

describe("overlayToBaseClip", () => {
  it("carries its own media for an asset that is not the base recording", () => {
    const clip = overlayToBaseClip(
      overlay({
        url: "broll.mp4",
        name: "B-roll",
        sourceStart: 2,
        duration: 3,
      }),
      source,
      12,
    );
    expect(clip.src).toEqual({
      url: "broll.mp4",
      kind: "video",
      name: "B-roll",
      duration: 12,
    });
    expect(clip.start).toBe(2);
    expect(clip.end).toBe(5);
  });

  it("becomes a plain recording slice when the overlay referenced the base", () => {
    // Same url as the source: it is a lifted slice of the recording, so folding
    // it back down must not give it its own src.
    const clip = overlayToBaseClip(
      overlay({ url: source.url, sourceStart: 4, duration: 6 }),
      source,
      60,
    );
    expect(clip.src).toBeUndefined();
    expect(clip.start).toBe(4);
    expect(clip.end).toBe(10);
  });

  it("carries its own media when there is no base source at all", () => {
    const clip = overlayToBaseClip(
      overlay({ url: "broll.mp4", sourceStart: 1, duration: 2 }),
      null,
      9,
    );
    expect(clip.src?.url).toBe("broll.mp4");
    expect(clip.start).toBe(1);
    expect(clip.end).toBe(3);
  });

  it("measures the source range from sourceStart, never the timeline position", () => {
    // The overlay sits at timeline 10 but plays [2, 5] of its own media. The
    // clip's range is the media slice, so a clip reading it never chops the
    // wrong footage. This is the invariant the src-timebase bug family breaks.
    const clip = overlayToBaseClip(
      overlay({ start: 10, sourceStart: 2, duration: 3 }),
      source,
      30,
    );
    expect(clip.start).toBe(2);
    expect(clip.end).toBe(5);
  });
});
