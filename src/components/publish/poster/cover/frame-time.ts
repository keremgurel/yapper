/**
 * Frame arithmetic for the picker. Finished exports are 30 fps; the picker
 * steps and labels in those frames so "the exact frame" means one frame.
 */
export const FRAMES_PER_SECOND = 30;
export const FRAME_SECONDS = 1 / FRAMES_PER_SECOND;

export function clampTime(time: number, duration: number): number {
  if (!Number.isFinite(time)) return 0;
  // The last decodable frame sits a little before the reported duration.
  const last = Math.max(0, duration - FRAME_SECONDS);
  return Math.min(Math.max(0, time), last);
}

export function snapToFrame(time: number): number {
  return Math.round(time * FRAMES_PER_SECOND) / FRAMES_PER_SECOND;
}

export function frameIndex(time: number): number {
  return Math.round(time * FRAMES_PER_SECOND);
}

/** m:ss.ff, the way an editor's timecode reads. */
export function formatTimecode(time: number): string {
  const safe = Number.isFinite(time) ? Math.max(0, time) : 0;
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const frames = Math.round((safe - Math.floor(safe)) * FRAMES_PER_SECOND);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${Math.min(
    frames,
    FRAMES_PER_SECOND - 1,
  )
    .toString()
    .padStart(2, "0")}`;
}
