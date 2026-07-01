"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clipTimelineStart,
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
      const found = sourceToTimelineSeq(clips, s);
      applyTimeline(found ? found.timeline : 0);
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

  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      const i = activeIndexRef.current;
      const clip = clips[i];
      if (!clip) return;
      if (v.currentTime >= clip.end - EPS) {
        const next = i + 1;
        if (next >= clips.length) {
          v.pause();
          setTimelineTime(total);
          setSourceTime(clip.end);
          clockRef.current = total;
          return;
        }
        activeIndexRef.current = next;
        seekVideo(next, clips[next].start, !v.paused);
        const t = clipTimelineStart(clips, next);
        setTimelineTime(t);
        clockRef.current = t;
        setSourceTime(clips[next].start);
        return;
      }
      if (v.currentTime < clip.start - EPS) {
        v.currentTime = clip.start;
        return;
      }
      const t = clipTimelineStart(clips, i) + (v.currentTime - clip.start);
      setTimelineTime(t);
      clockRef.current = t;
      setSourceTime(v.currentTime);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
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
