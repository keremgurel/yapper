import { describe, expect, it } from "vitest";
import { splitOverlaysAt } from "@/lib/studio/split-overlay";
import type { Overlay } from "@/lib/studio/types";

const ov = (over: Partial<Overlay>): Overlay =>
  ({
    id: "o",
    kind: "video",
    url: "v.mp4",
    name: "v",
    track: 0,
    start: 2,
    duration: 6,
    sourceStart: 1,
    ...over,
  }) as Overlay;

describe("splitOverlaysAt", () => {
  it("splits a video overlay, advancing the right half's in-point", () => {
    const out = splitOverlaysAt([ov({})], new Set(["o"]), 5); // local = 3
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ start: 2, duration: 3, sourceStart: 1 });
    // Right half plays the file continuously: in-point advances by 3s.
    expect(out[1]).toMatchObject({ start: 5, duration: 3, sourceStart: 4 });
  });

  it("carries an image overlay's in-point over unchanged (no timebase)", () => {
    const out = splitOverlaysAt([ov({ kind: "image" })], new Set(["o"]), 5);
    expect(out[1]).toMatchObject({ start: 5, duration: 3, sourceStart: 1 });
  });

  it("is a no-op when the cut is within EPS of either edge", () => {
    const overlays = [ov({})];
    // No split near the start (local 0.02) or the end (local 5.98), and the
    // overlay is passed through as-is, not rebuilt.
    const near = splitOverlaysAt(overlays, new Set(["o"]), 2.02);
    expect(near).toHaveLength(1);
    expect(near[0]).toBe(overlays[0]);
    expect(splitOverlaysAt(overlays, new Set(["o"]), 7.98)).toHaveLength(1);
  });

  it("leaves an overlay that is not in the id set untouched", () => {
    const other = ov({ id: "other" });
    const out = splitOverlaysAt([other], new Set(["o"]), 5);
    expect(out).toEqual([other]);
  });

  it("splits every targeted overlay in one pass", () => {
    const out = splitOverlaysAt(
      [ov({ id: "a" }), ov({ id: "b" })],
      new Set(["a", "b"]),
      5,
    );
    expect(out).toHaveLength(4);
  });
});
