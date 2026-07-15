import type { Clip, Overlay, StudioSource } from "@/lib/studio/types";

/** An overlay ready to place, minus the id and track the caller mints. */
export type LiftedOverlay = Omit<Overlay, "id" | "track">;

/**
 * The overlay a base clip becomes when it is lifted up onto a track. Returns
 * null when there is no media to point at.
 *
 * A clip that carries its own `src` (appended footage) keeps THAT media: its
 * start/end are in that media's timebase, so `sourceStart` and the recording's
 * url would disagree. Only a plain clip falls back to the base recording. Point
 * a lifted appended clip at the recording and it shows the wrong footage, at the
 * appended clip's source time, the classic source-vs-recording timebase mix-up.
 */
export function liftedOverlayFromClip(
  clip: Clip,
  source: StudioSource | null,
  timelineStart: number,
): LiftedOverlay | null {
  const media = clip.src ?? source;
  if (!media) return null;
  return {
    kind: media.kind ?? "video",
    url: media.url,
    name: media.name,
    start: Math.max(0, timelineStart),
    duration: Math.max(0.1, clip.end - clip.start),
    sourceStart: clip.start,
    muted: true,
  };
}
