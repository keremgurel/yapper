import { describe, expect, it } from "vitest";
import { nativeEditPreviewPlan } from "@/hooks/use-native-edit-preview";
import {
  registerNativePath,
  setNativeProxyPath,
} from "@/lib/studio/native/path-registry";
import type { Clip } from "@/lib/studio/types";

describe("nativeEditPreviewPlan", () => {
  it("uses ready proxies while preserving every edited range", () => {
    registerNativePath("asset://base", "/media/base.mov", 9 / 16, 100);
    setNativeProxyPath("asset://base", "/cache/base-proxy.mp4");
    const clips: Clip[] = [
      { id: "a", start: 3.25, end: 8.5 },
      { id: "b", start: 12, end: 18.75 },
    ];

    expect(nativeEditPreviewPlan(clips, "asset://base")).toEqual([
      { path: "/cache/base-proxy.mp4", start: 3.25, end: 8.5 },
      { path: "/cache/base-proxy.mp4", start: 12, end: 18.75 },
    ]);
  });

  it("falls back when any clip is not backed by native video", () => {
    registerNativePath("asset://known", "/media/known.mov", 16 / 9, 20);
    const clips: Clip[] = [
      { id: "a", start: 0, end: 3 },
      {
        id: "b",
        start: 0,
        end: 3,
        src: {
          url: "blob:browser-only",
          kind: "video",
          name: "browser-only.mp4",
          duration: 3,
        },
      },
    ];

    expect(nativeEditPreviewPlan(clips, "asset://known")).toBeNull();
  });

  it("recovers mounted-drive media after the in-memory registry is lost", () => {
    const url =
      "http://asset.localhost/Volumes/G%20MicroSD/DCIM/DJI_001/clip.mp4";
    const clips: Clip[] = [
      { id: "a", start: 10, end: 12 },
      { id: "b", start: 15, end: 18 },
    ];

    expect(nativeEditPreviewPlan(clips, url)).toEqual([
      {
        path: "/Volumes/G MicroSD/DCIM/DJI_001/clip.mp4",
        start: 10,
        end: 12,
      },
      {
        path: "/Volumes/G MicroSD/DCIM/DJI_001/clip.mp4",
        start: 15,
        end: 18,
      },
    ]);
  });
});
