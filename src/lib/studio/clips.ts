import { newClipId, type Clip } from "@/lib/studio/types";

const EPS = 0.02;

export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.end - clip.start);
}

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((sum, c) => sum + clipDuration(c), 0);
}

export function fullClip(duration: number): Clip[] {
  return [{ id: newClipId(), start: 0, end: duration }];
}

/** Split the clip that contains `sourceTime` into two clips at that point. */
export function splitAtSource(clips: Clip[], sourceTime: number): Clip[] {
  return clips.flatMap((c) => {
    if (sourceTime > c.start + EPS && sourceTime < c.end - EPS) {
      return [
        { id: newClipId(), start: c.start, end: sourceTime },
        { id: newClipId(), start: sourceTime, end: c.end },
      ];
    }
    return [c];
  });
}

export function removeClip(clips: Clip[], id: string): Clip[] {
  return clips.filter((c) => c.id !== id);
}

/** Subtract a source range [from, to] from the clip list (may split clips). */
export function removeSourceRange(
  clips: Clip[],
  from: number,
  to: number,
): Clip[] {
  if (to <= from) return clips;
  return clips.flatMap((c) => {
    // No overlap.
    if (to <= c.start + EPS || from >= c.end - EPS) return [c];
    const out: Clip[] = [];
    if (from > c.start + EPS) {
      out.push({ id: newClipId(), start: c.start, end: from });
    }
    if (to < c.end - EPS) {
      out.push({ id: newClipId(), start: to, end: c.end });
    }
    return out;
  });
}

export function trimClipStart(
  clips: Clip[],
  id: string,
  sourceTime: number,
): Clip[] {
  return clips.map((c) =>
    c.id === id && sourceTime > c.start && sourceTime < c.end - EPS
      ? { ...c, start: sourceTime }
      : c,
  );
}

export function trimClipEnd(
  clips: Clip[],
  id: string,
  sourceTime: number,
): Clip[] {
  return clips.map((c) =>
    c.id === id && sourceTime < c.end && sourceTime > c.start + EPS
      ? { ...c, end: sourceTime }
      : c,
  );
}

export function clipIndexAtSource(clips: Clip[], t: number): number {
  return clips.findIndex((c) => t >= c.start - EPS && t <= c.end + EPS);
}

/** Edited-timeline position (seconds) for a given source time. */
export function sourceToTimeline(clips: Clip[], sourceTime: number): number {
  let acc = 0;
  for (const c of clips) {
    if (sourceTime >= c.end) {
      acc += clipDuration(c);
    } else if (sourceTime >= c.start) {
      return acc + (sourceTime - c.start);
    } else {
      return acc;
    }
  }
  return acc;
}

/** Source time for a given edited-timeline position (seconds). */
export function timelineToSource(clips: Clip[], timelineTime: number): number {
  let acc = 0;
  for (const c of clips) {
    const d = clipDuration(c);
    if (timelineTime <= acc + d) return c.start + (timelineTime - acc);
    acc += d;
  }
  return clips.length ? clips[clips.length - 1].end : 0;
}

/**
 * Given the current source time during playback, decide what to do:
 * - a number: seek the video to it (we're in a removed gap or before the start)
 * - "end": playback reached the end of the edited timeline
 * - null: we're inside a kept clip, keep playing
 */
export function resolvePlayback(
  clips: Clip[],
  t: number,
): number | "end" | null {
  if (clips.length === 0) return "end";
  for (const c of clips) {
    if (t < c.start - EPS) return c.start;
    if (t <= c.end - EPS) return null;
  }
  return "end";
}
