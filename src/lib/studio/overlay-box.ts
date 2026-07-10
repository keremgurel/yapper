import type { OverlayRect } from "@/lib/studio/types";

/** The whole stage. What an overlay gets when nothing knows its shape. */
export const FULL_FRAME: OverlayRect = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Where a piece of media should sit when it first lands on an upper track: as
 * large as it can be without leaving the stage, centred, and still its own
 * shape. Overlays are painted with object-cover semantics, so a box of the
 * media's own aspect is exactly the box that crops nothing.
 *
 * Both aspects are width / height. A media whose shape is unknown fills the
 * stage, which is what it did before anyone thought to ask.
 */
export function fitBox(
  mediaAspect: number | undefined,
  stageAspect: number,
): OverlayRect {
  if (!mediaAspect || !stageAspect || !Number.isFinite(mediaAspect)) {
    return FULL_FRAME;
  }
  if (mediaAspect >= stageAspect) {
    // Wider than the stage: span it, and let the height fall where it may.
    const h = stageAspect / mediaAspect;
    return { x: 0, y: (1 - h) / 2, w: 1, h };
  }
  const w = mediaAspect / stageAspect;
  return { x: (1 - w) / 2, y: 0, w, h: 1 };
}

/** The aspect of a piece of media, or undefined when it never reported one. */
export function mediaAspect(media: {
  width?: number;
  height?: number;
}): number | undefined {
  if (!media.width || !media.height) return undefined;
  return media.width / media.height;
}
