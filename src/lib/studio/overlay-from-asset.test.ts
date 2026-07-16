import { describe, expect, it } from "vitest";
import { overlayFromAsset } from "@/lib/studio/overlay-from-asset";
import type { MediaAsset, Overlay } from "@/lib/studio/types";

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "m",
  kind: "video",
  url: "u",
  name: "clip.mp4",
  duration: 4,
  width: 1920,
  height: 1080,
  ...over,
});

const STAGE = 9 / 16;

describe("overlayFromAsset", () => {
  it("maps the asset onto a free track at the drop position", () => {
    const out = overlayFromAsset(asset(), 2, [], STAGE);
    expect(out).toMatchObject({
      kind: "video",
      url: "u",
      name: "clip.mp4",
      track: 0,
      start: 2,
      duration: 4,
      sourceStart: 0,
      muted: true,
    });
  });

  it("floors a negative drop position at 0", () => {
    expect(overlayFromAsset(asset(), -3, [], STAGE).start).toBe(0);
  });

  it("lands on the next free track when the drop time is occupied", () => {
    const existing = [{ id: "o", track: 0, start: 0, duration: 10 } as Overlay];
    expect(overlayFromAsset(asset(), 2, existing, STAGE).track).toBe(1);
  });

  it("fills the whole frame when the media never reported its size", () => {
    const out = overlayFromAsset(
      asset({ width: undefined, height: undefined }),
      0,
      [],
      STAGE,
    );
    expect(out).toMatchObject({ x: 0, y: 0, w: 1, h: 1 });
  });
});
