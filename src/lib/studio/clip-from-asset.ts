import { newClipId, type Clip, type MediaAsset } from "@/lib/studio/types";

/**
 * A base-track clip that appends a whole video asset. It carries the asset's own
 * media as its `src`, so it reads its own file and its OWN timebase rather than
 * the project recording (comparing an appended clip against the recording's
 * seconds is the bug this pattern exists to avoid). It spans the entire asset;
 * trimming narrows it later. Only meaningful for video assets, since images
 * layer as overlays rather than driving the base clock.
 */
export function clipFromAsset(asset: MediaAsset): Clip {
  return {
    id: newClipId(),
    start: 0,
    end: asset.duration,
    src: {
      url: asset.url,
      kind: "video",
      name: asset.name,
      duration: asset.duration,
      width: asset.width,
      height: asset.height,
    },
  };
}
