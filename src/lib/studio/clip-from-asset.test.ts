import { describe, expect, it } from "vitest";
import { clipFromAsset } from "@/lib/studio/clip-from-asset";
import type { MediaAsset } from "@/lib/studio/types";

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "m",
  kind: "video",
  url: "clip.mp4",
  name: "My clip",
  duration: 8,
  width: 1080,
  height: 1920,
  ...over,
});

describe("clipFromAsset", () => {
  it("spans the whole asset and carries its media as the clip's own src", () => {
    const clip = clipFromAsset(asset());
    expect(clip.start).toBe(0);
    expect(clip.end).toBe(8);
    expect(clip.src).toEqual({
      url: "clip.mp4",
      kind: "video", // a base clip always drives the video clock
      name: "My clip",
      duration: 8,
      width: 1080,
      height: 1920,
    });
    expect(typeof clip.id).toBe("string");
  });

  it("passes through missing dimensions rather than inventing them", () => {
    const clip = clipFromAsset(asset({ width: undefined, height: undefined }));
    expect(clip.src?.width).toBeUndefined();
    expect(clip.src?.height).toBeUndefined();
    expect(clip.src?.duration).toBe(8);
  });
});
