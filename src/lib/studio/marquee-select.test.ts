import { describe, expect, it } from "vitest";
import { marqueeSelection } from "@/lib/studio/marquee-select";
import type { AudioTrack, Caption, Clip, Overlay } from "@/lib/studio/types";

// A box catches an item when the item's LANE is within the box vertically (the
// caller resolves that into `rows`) AND the item's timeline span overlaps the
// box's x-span. Positions are in content pixels: an item at time t sits at
// padLeft + t * pxPerSec, so padLeft must be folded in on both sides.
const clip = (id: string): Clip => ({ id, start: 0, end: 0 });
const overlay = (id: string, track: number, start: number, dur: number) =>
  ({ id, track, start, duration: dur }) as Overlay;
const audio = (id: string, start: number, dur: number) =>
  ({ id, start, duration: dur }) as AudioTrack;
const caption = (id: string) => ({ id }) as Caption;

const PAD = 100;
const PX = 10;

describe("marqueeSelection", () => {
  // Three base clips laid end to end: [0,2), [2,5), [5,6) seconds.
  const clips = [clip("a"), clip("b"), clip("c")];
  const clipOffsets = [0, 2, 5];
  const durations: Record<string, number> = { a: 2, b: 3, c: 1 };
  const data = {
    clips: clips.map((c) => ({ ...c, end: durations[c.id] })),
    clipOffsets,
    overlays: [overlay("o0", 0, 0, 2), overlay("o1", 1, 0, 2)],
    captions: [caption("cap"), caption("degenerate")],
    captionRange: (c: Caption) =>
      c.id === "cap" ? { start: 0, end: 2 } : { start: 3, end: 3 },
    audioTracks: [audio("aud0", 0, 2), audio("aud1", 0, 2)],
  };

  it("selects only the base clips whose x-span the box overlaps", () => {
    // Box over px [125,135] = seconds [2.5,3.5], inside clip b only.
    const out = marqueeSelection(
      { left: 125, right: 135 },
      PAD,
      PX,
      { base: true, caption: false, tracks: new Set(), audio: new Set() },
      data,
    );
    expect(out.clipIds).toEqual(["b"]);
  });

  it("selects no clips when the box misses the base row, even if x overlaps", () => {
    const out = marqueeSelection(
      { left: 125, right: 135 },
      PAD,
      PX,
      { base: false, caption: false, tracks: new Set(), audio: new Set() },
      data,
    );
    expect(out.clipIds).toEqual([]);
  });

  it("folds padLeft into the item's position", () => {
    // Box over px [105,115]. Clip a sits at px [100,120] only because padLeft
    // is added; without it the clip would be at [0,20] and miss the box.
    const out = marqueeSelection(
      { left: 105, right: 115 },
      PAD,
      PX,
      { base: true, caption: false, tracks: new Set(), audio: new Set() },
      data,
    );
    expect(out.clipIds).toEqual(["a"]);
  });

  it("gates overlays by their track row, not just x-overlap", () => {
    // Both overlays overlap the box in x; only track 0's row is hit.
    const out = marqueeSelection(
      { left: 105, right: 115 },
      PAD,
      PX,
      { base: false, caption: false, tracks: new Set([0]), audio: new Set() },
      data,
    );
    expect(out.overlayIds).toEqual(["o0"]);
  });

  it("skips a degenerate caption whose range has no width", () => {
    const out = marqueeSelection(
      { left: 105, right: 135 },
      PAD,
      PX,
      { base: false, caption: true, tracks: new Set(), audio: new Set() },
      data,
    );
    // "degenerate" spans [3,3]; even though px 130 is inside the box it's skipped.
    expect(out.captionIds).toEqual(["cap"]);
  });

  it("gates audio clips by their own row id", () => {
    const out = marqueeSelection(
      { left: 105, right: 115 },
      PAD,
      PX,
      {
        base: false,
        caption: false,
        tracks: new Set(),
        audio: new Set(["aud0"]),
      },
      data,
    );
    expect(out.audioIds).toEqual(["aud0"]);
  });
});
