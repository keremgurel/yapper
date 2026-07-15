/** A fine nudge: roughly one frame at 30fps, for stepping the playhead. */
export const FRAME_STEP = 1 / 30;
/** A coarse nudge (Shift held): one second, for moving through the timeline. */
export const JUMP_STEP = 1;

/**
 * The timeline time a transport key seeks to, clamped into [0, duration], or
 * null when the key isn't a transport key. Left/Right step by a frame (a second
 * with Shift); Home and End jump to the ends. Keeping this pure lets the
 * keyboard handler stay a thin wire from key to seek.
 */
export function transportSeek(
  key: string,
  current: number,
  duration: number,
  shift: boolean,
): number | null {
  let target: number;
  switch (key) {
    case "ArrowLeft":
      target = current - (shift ? JUMP_STEP : FRAME_STEP);
      break;
    case "ArrowRight":
      target = current + (shift ? JUMP_STEP : FRAME_STEP);
      break;
    case "Home":
      target = 0;
      break;
    case "End":
      target = duration;
      break;
    default:
      return null;
  }
  return Math.max(0, Math.min(duration, target));
}
