"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clipTimelineStart,
  sourceToTimeline,
  sourceToTimelineSeq,
  timelineToClip,
  totalDuration,
} from "@/lib/studio/clips";
import type { Clip } from "@/lib/studio/types";

const EPS = 0.03;

export interface PlaybackInput {
  /** Bottom-track clips. May be empty — overlays and audio still play. */
  clips: Clip[];
  /** Length of the whole project (longest layer), not just the bottom track. */
  total: number;
  /** Can the bottom track drive a <video> clock (it exists and isn't a still)? */
  hasVideo: boolean;
  /** Media for clips that don't carry their own `src`. */
  baseUrl: string;
}

/**
 * Drives playback with the *edited timeline* as the master clock.
 *
 * While the playhead is over the bottom track, the <video> element is the clock:
 * its own audio and frames stay in sync for free, and each clip can carry its
 * own `src` (that's how appended videos play). Everywhere else — an empty bottom
 * track, a still-image base, or the stretch of timeline where overlays or audio
 * outlast the bottom track — a rAF clock takes over. The two hand off to each
 * other at the bottom track's end.
 */
export function useStudioPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  { clips, total, hasVideo, baseUrl }: PlaybackInput,
) {
  const [timelineTime, setTimelineTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activeIndexRef = useRef(0);
  const clockRef = useRef(0);
  const lastRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // Set while we pause the <video> on purpose (a clock handoff or a seek out of
  // the bottom track). Its async 'pause' event must not clear `playing`.
  const silentPauseRef = useRef(false);
  const baseTotal = totalDuration(clips);

  const clipUrl = useCallback(
    (i: number) => clips[i]?.src?.url ?? baseUrl,
    [clips, baseUrl],
  );

  /** Is `t` over the bottom track, so the <video> should be the clock? */
  const overBaseTrack = useCallback(
    (t: number) => hasVideo && t < baseTotal - EPS,
    [hasVideo, baseTotal],
  );

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const pauseVideoSilently = useCallback(() => {
    const v = videoRef.current;
    if (!v || v.paused) return;
    silentPauseRef.current = true;
    v.pause();
  }, [videoRef]);

  // Point the <video> at clip `index` and seek to `srcTime`, switching the media
  // source first if this clip uses a different one. Resumes play if `resume`.
  const seekVideo = useCallback(
    (index: number, srcTime: number, resume: boolean) => {
      const v = videoRef.current;
      if (!v) return;
      const url = clipUrl(index);
      if (v.getAttribute("src") !== url) {
        v.setAttribute("src", url);
        v.load();
        const onLoaded = () => {
          v.currentTime = srcTime;
          if (resume) void v.play().catch(() => {});
        };
        v.addEventListener("loadeddata", onLoaded, { once: true });
      } else {
        v.currentTime = srcTime;
        if (resume && v.paused) void v.play().catch(() => {});
      }
    },
    [videoRef, clipUrl],
  );

  /** Run the synthetic clock from `from` to the project end. */
  const startRaf = useCallback(
    (from: number) => {
      stopRaf();
      clockRef.current = from;
      setTimelineTime(from);
      setPlaying(true);
      lastRef.current = performance.now();
      const tick = () => {
        const now = performance.now();
        clockRef.current = Math.min(
          total,
          clockRef.current + (now - lastRef.current) / 1000,
        );
        lastRef.current = now;
        setTimelineTime(clockRef.current);
        if (!hasVideo) setSourceTime(clockRef.current);
        if (clockRef.current >= total - EPS) {
          setPlaying(false);
          rafRef.current = null;
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [total, hasVideo, stopRaf],
  );

  const applyTimeline = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, total));
      const wasPlaying = playing;
      setTimelineTime(clamped);
      clockRef.current = clamped;
      if (overBaseTrack(clamped)) {
        stopRaf();
        const hit = timelineToClip(clips, clamped);
        if (hit && videoRef.current) {
          activeIndexRef.current = hit.index;
          seekVideo(hit.index, hit.sourceTime, wasPlaying);
          setSourceTime(hit.sourceTime);
        }
        return;
      }
      // Past the bottom track (or there isn't one): the rAF clock owns this.
      pauseVideoSilently();
      setSourceTime(clamped);
      if (wasPlaying && clamped < total - EPS) startRaf(clamped);
      else stopRaf();
    },
    [
      videoRef,
      clips,
      total,
      playing,
      overBaseTrack,
      seekVideo,
      startRaf,
      stopRaf,
      pauseVideoSilently,
    ],
  );

  const seekToTimeline = useCallback(
    (t: number) => applyTimeline(t),
    [applyTimeline],
  );

  const seekToSource = useCallback(
    (s: number) => {
      // Prefer the exact clip containing `s`. When `s` sits just before a clip
      // (e.g. a word whose start rounds into the preceding cut, but whose
      // midpoint is kept), fall back to the mapped timeline position — the start
      // of that clip — NOT 0, which would jump the playhead to the beginning.
      const found = sourceToTimelineSeq(clips, s);
      applyTimeline(found ? found.timeline : sourceToTimeline(clips, s));
    },
    [clips, applyTimeline],
  );

  const play = useCallback(() => {
    if (total <= 0) return;
    const from = clockRef.current >= total - EPS ? 0 : clockRef.current;
    if (overBaseTrack(from)) {
      const v = videoRef.current;
      if (!v) return;
      const hit = timelineToClip(clips, from);
      if (hit) {
        activeIndexRef.current = hit.index;
        setTimelineTime(from);
        clockRef.current = from;
        seekVideo(hit.index, hit.sourceTime, true);
      }
      return;
    }
    startRaf(from);
  }, [videoRef, clips, total, overBaseTrack, seekVideo, startRaf]);

  const pause = useCallback(() => {
    stopRaf();
    videoRef.current?.pause();
    setPlaying(false);
  }, [videoRef, stopRaf]);

  useEffect(() => stopRaf, [stopRaf]);

  // The clock source changed (the bottom track was deleted, added, or swapped
  // between video and still). Stop, rather than leave `playing` true with the
  // old clock gone and nothing ticking in its place.
  useEffect(() => {
    stopRaf();
    videoRef.current?.pause();
    setPlaying(false);
  }, [hasVideo, stopRaf, videoRef]);

  // Keep the video pointed at the clip under the playhead when the edit changes.
  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const hit = timelineToClip(clips, clockRef.current);
    if (hit) {
      activeIndexRef.current = hit.index;
      seekVideo(hit.index, hit.sourceTime, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, hasVideo]);

  // Drive the clock and clip-boundary jumps per PRESENTED FRAME
  // (requestVideoFrameCallback), not the ~4Hz `timeupdate` event. At 4Hz the
  // playhead overshoots each cut by up to ~250ms, so the removed region (a
  // retake, a pause) leaks on screen and captions lag; per-frame detection cuts
  // that to a single frame. rAF is the fallback when rVFC is unavailable.
  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;

    const vfc = v as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (h: number) => void;
    };
    const useRvfc = typeof vfc.requestVideoFrameCallback === "function";
    let handle: number | null = null;
    // True between initiating a boundary jump and its 'seeked' landing. Guards
    // against re-evaluating the boundary while currentTime is still the old
    // value — which, when the next clip is reordered EARLIER in the source,
    // would look "past clip.end" again and skip that clip.
    let seeking = false;
    let seekTarget = 0;
    const onSeeked = () => {
      seeking = false;
    };
    v.addEventListener("seeked", onSeeked);

    const cancel = () => {
      if (handle == null) return;
      if (useRvfc) vfc.cancelVideoFrameCallback?.(handle);
      else cancelAnimationFrame(handle);
      handle = null;
    };
    const schedule = () => {
      if (v.paused) return;
      handle = useRvfc
        ? (vfc.requestVideoFrameCallback?.(step) ?? null)
        : requestAnimationFrame(step);
    };

    /** The bottom track just ran out. Either the project ends here, or the rAF
     * clock carries the overlays and audio that outlast it. */
    function endOfBaseTrack() {
      setSourceTime(clips[clips.length - 1].end);
      if (total > baseTotal + EPS) {
        silentPauseRef.current = true;
        v!.pause();
        startRaf(baseTotal);
        return;
      }
      v!.pause();
      setTimelineTime(total);
      clockRef.current = total;
    }

    function step() {
      if (seeking) {
        // Clear on the 'seeked' event OR once currentTime actually reaches the
        // target (the event won't fire if the target equalled currentTime).
        if (Math.abs(v!.currentTime - seekTarget) < 0.05) seeking = false;
        else {
          schedule();
          return; // wait for the boundary seek to land before re-evaluating
        }
      }
      const i = activeIndexRef.current;
      const clip = clips[i];
      if (clip) {
        if (v!.currentTime >= clip.end) {
          const next = i + 1;
          if (next >= clips.length) {
            endOfBaseTrack();
            return; // the rAF clock or the end-of-project stop takes it from here
          }
          seeking = true;
          seekTarget = clips[next].start;
          activeIndexRef.current = next;
          seekVideo(next, clips[next].start, !v!.paused);
          const t = clipTimelineStart(clips, next);
          setTimelineTime(t);
          clockRef.current = t;
          setSourceTime(clips[next].start);
        } else if (v!.currentTime < clip.start - EPS) {
          v!.currentTime = clip.start;
        } else {
          const t = clipTimelineStart(clips, i) + (v!.currentTime - clip.start);
          setTimelineTime(t);
          clockRef.current = t;
          setSourceTime(v!.currentTime);
        }
      }
      schedule();
    }

    const onPlay = () => {
      stopRaf(); // the video is the clock again
      setPlaying(true);
      cancel();
      schedule();
    };
    const onPause = () => {
      cancel();
      // A handoff or a seek out of the bottom track paused it deliberately —
      // the rAF clock is (or is about to be) running, so playback continues.
      if (silentPauseRef.current) {
        silentPauseRef.current = false;
        return;
      }
      setPlaying(false);
    };
    const onEnded = () => {
      cancel();
      if (silentPauseRef.current) return;
      setPlaying(false);
      setTimelineTime(total);
      clockRef.current = total;
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    if (!v.paused) schedule();
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("seeked", onSeeked);
      cancel();
    };
  }, [
    videoRef,
    clips,
    total,
    baseTotal,
    hasVideo,
    seekVideo,
    startRaf,
    stopRaf,
  ]);

  return {
    timelineTime,
    sourceTime,
    playing,
    play,
    pause,
    seekToTimeline,
    seekToSource,
  };
}
