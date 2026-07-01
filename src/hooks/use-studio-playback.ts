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
 * Drives playback with the *edited timeline* as the master clock. With a video
 * base it drives a <video> (clips play in array order; at each boundary the
 * video seeks to the next clip's source start). With an image base (`hasVideo`
 * false) there's no media element, so a requestAnimationFrame clock advances
 * time instead. Returns the timeline position, raw source time, and transport.
 */
export function useStudioPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clips: Clip[],
  hasVideo = true,
) {
  const [timelineTime, setTimelineTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activeIndexRef = useRef(0);
  const clockRef = useRef(0); // synthetic clock position
  const lastRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const total = totalDuration(clips);

  // Position the clocks (and the video, when present) at a given timeline time.
  const applyTimeline = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, total));
      setTimelineTime(clamped);
      clockRef.current = clamped;
      const hit = timelineToClip(clips, clamped);
      const v = videoRef.current;
      if (hasVideo && hit && v) {
        activeIndexRef.current = hit.index;
        v.currentTime = hit.sourceTime;
        setSourceTime(hit.sourceTime);
      } else if (!hasVideo) {
        setSourceTime(clamped);
      }
    },
    [videoRef, clips, total, hasVideo],
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
    if (clockRef.current >= total - EPS) applyTimeline(0);
    if (hasVideo) {
      const v = videoRef.current;
      if (!v) return;
      void v.play();
      return;
    }
    // Synthetic clock (image base).
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
  }, [videoRef, clips, total, hasVideo, applyTimeline]);

  const pause = useCallback(() => {
    if (hasVideo) videoRef.current?.pause();
    else {
      stopRaf();
      setPlaying(false);
    }
  }, [videoRef, hasVideo, stopRaf]);

  // Stop any synthetic loop on unmount / when switching to a video base.
  useEffect(() => stopRaf, [stopRaf, hasVideo]);

  useEffect(() => {
    if (!hasVideo) return;
    const v = videoRef.current;
    if (!v) return;
    // Re-sync the active clip to the current source position after edits/reorder.
    const synced = sourceToTimelineSeq(clips, v.currentTime);
    if (synced) activeIndexRef.current = synced.index;

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
          return;
        }
        activeIndexRef.current = next;
        v.currentTime = clips[next].start;
        setTimelineTime(clipTimelineStart(clips, next));
        setSourceTime(clips[next].start);
        return;
      }
      if (v.currentTime < clip.start - EPS) {
        v.currentTime = clip.start;
        return;
      }
      setTimelineTime(
        clipTimelineStart(clips, i) + (v.currentTime - clip.start),
      );
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
  }, [videoRef, clips, total, hasVideo]);

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
