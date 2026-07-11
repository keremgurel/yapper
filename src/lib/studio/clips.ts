import { newClipId, type Clip } from "@/lib/studio/types";

const EPS = 0.02;

export function clipDuration(clip: Clip): number {
  return Math.max(0, clip.end - clip.start);
}

/** The media a clip reads from: its own, else the project's recording. */
export function clipMediaUrl(clip: Clip, baseUrl: string): string {
  return clip.src?.url ?? baseUrl;
}

/** How long that media runs — the ceiling for trimming this clip's out-point. */
export function clipMediaDuration(clip: Clip, baseDuration: number): number {
  return clip.src?.duration ?? baseDuration;
}

/**
 * How far a clip's edges can be dragged, in its own media's seconds. A clip is
 * only fenced in by a neighbour that reads the same media (two slices of one
 * recording can't overlap); otherwise it's free to use its whole media. Getting
 * this wrong lets an appended clip trim against the recording's timestamps.
 */
export function trimBounds(
  clips: Clip[],
  index: number,
  baseDuration: number,
): { min: number; max: number } {
  const clip = clips[index];
  const prev = clips[index - 1];
  const next = clips[index + 1];
  const sameMedia = (other: Clip | undefined) =>
    other != null && other.src?.url === clip.src?.url;
  return {
    min: sameMedia(prev) ? prev.end : 0,
    max: sameMedia(next) ? next.start : clipMediaDuration(clip, baseDuration),
  };
}

export function totalDuration(clips: Clip[]): number {
  return clips.reduce((sum, c) => sum + clipDuration(c), 0);
}

export function fullClip(duration: number): Clip[] {
  return [{ id: newClipId(), start: 0, end: duration }];
}

/**
 * Split the clip sitting at edited-timeline position `t` into two, at that
 * point. The clip is identified by its position on the timeline rather than by
 * a source timestamp, so it always cuts the clip you can see under the playhead:
 * clips carrying their own media have source ranges that can collide with the
 * recording's, and matching on source time alone would cut the wrong one.
 */
export function splitClipAt(clips: Clip[], t: number): Clip[] {
  const hit = timelineToClip(clips, t);
  if (!hit) return clips;
  const at = hit.sourceTime;
  const target = clips[hit.index];
  if (at <= target.start + EPS || at >= target.end - EPS) return clips;
  return clips.flatMap((c, i) =>
    i === hit.index
      ? [
          { ...c, id: newClipId(), end: at },
          { ...c, id: newClipId(), start: at },
        ]
      : [c],
  );
}

export function removeClip(clips: Clip[], id: string): Clip[] {
  return clips.filter((c) => c.id !== id);
}

/**
 * A clip reads the project's recording when it carries no media of its own.
 * Source-range edits — everything driven by the transcript — are expressed in
 * the recording's seconds, so they may only ever touch these clips. An appended
 * clip's start/end count seconds into a different file entirely; comparing them
 * against the recording's timestamps silently chops unrelated footage.
 */
const readsRecording = (clip: Clip): boolean => clip.src == null;

/**
 * Add a previously-cut source range [from, to] of the recording back into the
 * timeline, merging with any recording clips it now touches. Used to "undelete"
 * words/ranges.
 *
 * The recording's clips are rebuilt in source order (restore happens during
 * transcript cleanup, before any manual reorder, so re-sorting them is the
 * expected behavior). Appended clips keep their place in the sequence: they have
 * their own timebase, and sorting them by `start` would yank them out of order.
 */
export function restoreSourceRange(
  clips: Clip[],
  from: number,
  to: number,
): Clip[] {
  if (to <= from) return clips;

  const restored = [
    ...clips.filter(readsRecording),
    { id: newClipId(), start: from, end: to },
  ].sort((a, b) => a.start - b.start);

  const merged: Clip[] = [];
  for (const c of restored) {
    const last = merged[merged.length - 1];
    if (last && c.start <= last.end + EPS) {
      last.end = Math.max(last.end, c.end);
    } else {
      merged.push({ ...c });
    }
  }

  // Splice the rebuilt recording clips back in where the first of them sat, so
  // the appended clips around them do not move.
  const firstRecording = clips.findIndex(readsRecording);
  const out: Clip[] = [];
  clips.forEach((c, i) => {
    if (i === firstRecording) out.push(...merged);
    if (!readsRecording(c)) out.push(c);
  });
  if (firstRecording < 0) out.push(...merged);
  return out;
}

/**
 * Subtract a source range [from, to] of the recording from the clip list (may
 * split clips). Appended clips pass through untouched — see `readsRecording`.
 */
export function removeSourceRange(
  clips: Clip[],
  from: number,
  to: number,
): Clip[] {
  if (to <= from) return clips;
  return clips.flatMap((c) => {
    if (!readsRecording(c)) return [c];
    // No overlap.
    if (to <= c.start + EPS || from >= c.end - EPS) return [c];
    const out: Clip[] = [];
    if (from > c.start + EPS) {
      out.push({ ...c, id: newClipId(), end: from });
    }
    if (to < c.end - EPS) {
      out.push({ ...c, id: newClipId(), start: to });
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

/**
 * Index of the recording clip that keeps source second `t`, or -1 when that
 * second was cut. Appended clips are skipped: their `start`/`end` count seconds
 * into their own file, so a word at recording second 3.5 must not be reported as
 * kept merely because some appended clip happens to span 0..4 of its own media.
 */
export function clipIndexAtSource(clips: Clip[], t: number): number {
  return clips.findIndex(
    (c) => readsRecording(c) && t >= c.start - EPS && t <= c.end + EPS,
  );
}

/**
 * Edited-timeline position (seconds) of a given second of the recording.
 * Appended clips hold no recording seconds, but they do occupy the timeline, so
 * they contribute their duration and nothing else.
 *
 * The recording's clips are searched in timeline order, never assumed to run in
 * source order: dragging a clip earlier reorders the array, and a caption
 * anchored in the moved clip has to follow it. A second that was cut belongs to
 * no clip, so it collapses onto the cut point of whichever recording clip it
 * sits closest to in source seconds.
 */
export function sourceToTimeline(clips: Clip[], sourceTime: number): number {
  let acc = 0;
  let nearest: { gap: number; timeline: number } | null = null;
  for (const c of clips) {
    const d = clipDuration(c);
    if (readsRecording(c)) {
      if (sourceTime >= c.start && sourceTime <= c.end) {
        return acc + (sourceTime - c.start);
      }
      const before = sourceTime < c.start;
      const gap = before ? c.start - sourceTime : sourceTime - c.end;
      // Cut seconds land on the near edge of the clip: the moment just before
      // this clip if they precede it, the moment just after if they follow it.
      if (nearest === null || gap < nearest.gap) {
        nearest = { gap, timeline: before ? acc : acc + d };
      }
    }
    acc += d;
  }
  return nearest?.timeline ?? 0;
}

/**
 * The recording second playing at a given edited-timeline position. Over an
 * appended clip there is no such second, so the position clamps to the nearest
 * recording moment. Callers anchored in the recording (captions) then land
 * somewhere real instead of on an unrelated file's timestamp.
 */
export function timelineToSource(clips: Clip[], timelineTime: number): number {
  let acc = 0;
  let lastRecordingEnd: number | null = null;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const d = clipDuration(c);
    if (timelineTime <= acc + d) {
      if (readsRecording(c)) return c.start + (timelineTime - acc);
      if (lastRecordingEnd != null) return lastRecordingEnd;
      const next = clips.slice(i).find(readsRecording);
      return next ? next.start : 0;
    }
    acc += d;
    if (readsRecording(c)) lastRecordingEnd = c.end;
  }
  return lastRecordingEnd ?? 0;
}

/** Cumulative edited-timeline start (seconds) of the clip at `index`. */
export function clipTimelineStart(clips: Clip[], index: number): number {
  return clips.slice(0, index).reduce((s, c) => s + clipDuration(c), 0);
}

export interface TimelineHit {
  index: number;
  sourceTime: number;
}

/**
 * Map an edited-timeline position to the clip playing there (in array order)
 * and the matching source time. This is what makes reordered clips playable:
 * the timeline, not the source, defines order.
 */
export function timelineToClip(clips: Clip[], t: number): TimelineHit | null {
  if (clips.length === 0) return null;
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const d = clipDuration(clips[i]);
    if (t <= acc + d + EPS) {
      // Clamp into the clip's own source range: the +EPS slack must never
      // resolve to a source time past clip.end (into the removed region).
      const sourceTime = Math.min(
        clips[i].end,
        clips[i].start + Math.max(0, t - acc),
      );
      return { index: i, sourceTime };
    }
    acc += d;
  }
  const last = clips.length - 1;
  return { index: last, sourceTime: clips[last].end };
}

/**
 * Edited-timeline position of the first recording clip (array order) that keeps
 * `sourceTime`. Used to jump the timeline to a clicked transcript word. Null
 * when that second is not on the timeline at all.
 */
export function sourceToTimelineSeq(
  clips: Clip[],
  sourceTime: number,
): { index: number; timeline: number } | null {
  let acc = 0;
  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    if (
      readsRecording(c) &&
      sourceTime >= c.start - EPS &&
      sourceTime <= c.end + EPS
    ) {
      return { index: i, timeline: acc + Math.max(0, sourceTime - c.start) };
    }
    acc += clipDuration(c);
  }
  return null;
}

/** Reorder: move a clip to a new index within the array. */
export function moveClipTo(clips: Clip[], id: string, toIndex: number): Clip[] {
  const from = clips.findIndex((c) => c.id === id);
  if (from < 0) return clips;
  const next = clips.slice();
  const [moved] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, toIndex)), 0, moved);
  return next;
}
