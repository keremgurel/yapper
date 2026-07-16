import { fitBox, mediaAspect } from "@/lib/studio/overlay-box";
import { firstFreeTrack } from "@/lib/studio/tracks";
import type { MediaAsset, Overlay } from "@/lib/studio/types";

/**
 * The overlay a library asset becomes when dropped onto an upper track at
 * `start`, minus its id (the caller mints that). It arrives sized to its own
 * shape and centred (object-cover crops nothing when the box matches the media),
 * muted, from the media's head, on the lowest track free at that time. Start is
 * floored at 0 so a drop that reaches before the timeline still lands on it.
 *
 * Pure: no id and no commit, so a state updater can stay pure.
 */
export function overlayFromAsset(
  asset: MediaAsset,
  start: number,
  existing: Overlay[],
  aspect: number,
): Omit<Overlay, "id"> {
  const at = Math.max(0, start);
  return {
    kind: asset.kind,
    url: asset.url,
    name: asset.name,
    track: firstFreeTrack(existing, {
      id: "new",
      start: at,
      duration: asset.duration,
    }),
    start: at,
    duration: asset.duration,
    sourceStart: 0,
    muted: true,
    ...fitBox(mediaAspect(asset), aspect),
  };
}
