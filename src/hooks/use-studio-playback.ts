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

/**
 * Drives playback with the *edited timeline* as the master clock. Each main
 * clip can carry its own source (`clip.src`), so the video element switches its
 * `src` at boundaries between different sources — that's how appended videos on
 * the main track play (each with its own audio). Clips without `src` use the
 * base `baseUrl`. With an image base (`hasVideo` false) a rAF clock is used.
 */
export function useStudioPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clips: Clip[],
  hasVideo = true,
  baseUrl = "",
) {
  const [timelineTime, setTimelineTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activeIndexRef = useRef(0);
  const clockRef = useRef(0);
  const lastRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const total = totalDuration(clips);

  const clipUrl = useCallback(
    (i: number) => clips[i]?.src?.url ?? baseUrl,
    [clips, baseUrl],
  );

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

  const applyTimeline = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, total));
      setTimelineTime(clamped);
      clockRef.current = clamped;
      const hit = timelineToClip(clips, clamped);
      if (hasVideo && hit && videoRef.current) {
        activeIndexRef.current = hit.index;
        seekVideo(hit.index, hit.sourceTime, false);
        setSourceTime(hit.sourceTime);
      } else if (!hasVideo) {
        setSourceTime(clamped);
      }
    },
    [videoRef, clips, total, hasVideo, seekVideo],
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

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const play = useCallback(() => {
    if (clips.length === 0) return;
    const from = clockRef.current >= total - EPS ? 0 : clockRef.current;
    if (hasVideo) {
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
    // Synthetic clock (image base).
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
      setSourceTime(clockRef.current);
      if (clockRef.current >= total - EPS) {
        setPlaying(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [videoRef, clips, total, hasVideo, seekVideo]);

  const pause = useCallback(() => {
    if (hasVideo) videoRef.current?.pause();
    else {
      stopRaf();
      setPlaying(false);
    }
  }, [videoRef, hasVideo, stopRaf]);

  useEffect(() => stopRaf, [stopRaf, hasVideo]);

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
            v!.pause();
            setTimelineTime(total);
            setSourceTime(clip.end);
            clockRef.current = total;
            return; // playback ended; onPause/onEnded stop the loop
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
      setPlaying(true);
      cancel();
      schedule();
    };
    const onPause = () => {
      setPlaying(false);
      cancel();
    };
    const onEnded = () => {
      setPlaying(false);
      cancel();
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
  }, [videoRef, clips, total, hasVideo, seekVideo]);

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
