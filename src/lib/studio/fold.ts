import {
  newClipId,
  type Clip,
  type Overlay,
  type StudioSource,
} from "@/lib/studio/types";

/**
 * The base-sequence clip an overlay folds into when it is dragged down onto the
 * bottom layer.
 *
 * Its source range is the overlay's PLAYED slice measured in the overlay's own
 * media seconds, `[sourceStart, sourceStart + duration]`, never its timeline
 * position `start`: a clip's start/end count seconds into whatever media it
 * reads, so using the timeline position here would chop the wrong footage (the
 * recurring src-timebase bug).
 *
 * An overlay that referenced the base recording (same url as `source`) becomes
 * a plain recording slice with no `src`; any other asset becomes a clip that
 * carries its own media. Video only, since images can't drive the base clock;
 * the caller filters those out. `assetDuration` is the folded media's full
 * length, which the caller resolves from the library. Pure.
 */
export function overlayToBaseClip(
  overlay: Overlay,
  source: StudioSource | null,
  assetDuration: number,
): Clip {
  const carriesOwnMedia = !source || overlay.url !== source.url;
  return {
    id: newClipId(),
    start: overlay.sourceStart,
    end: overlay.sourceStart + overlay.duration,
    src: carriesOwnMedia
      ? {
          url: overlay.url,
          kind: "video",
          name: overlay.name,
          duration: assetDuration,
        }
      : undefined,
  };
}
