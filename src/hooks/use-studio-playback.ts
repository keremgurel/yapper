"use client";

import { useCallback, useEffect, useState } from "react";
import { resolvePlayback } from "@/lib/studio/clips";
import type { Clip } from "@/lib/studio/types";

/**
 * Drives a <video> element so playback skips removed regions (the gaps between
 * clips). Returns the current source time, play state, and transport helpers.
 * Re-subscribes when `clips` change so the skip logic always uses the latest edit.
 */
export function useStudioPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clips: Clip[],
) {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const action = resolvePlayback(clips, v.currentTime);
    if (action === "end") {
      const first = clips[0];
      if (!first) return;
      v.currentTime = first.start;
    } else if (typeof action === "number") {
      v.currentTime = action;
    }
    void v.play();
  }, [videoRef, clips]);

  const pause = useCallback(() => videoRef.current?.pause(), [videoRef]);

  const seekToSource = useCallback(
    (t: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = t;
      setCurrentTime(t);
    },
    [videoRef],
  );

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => {
      const action = resolvePlayback(clips, v.currentTime);
      if (action === "end") {
        v.pause();
        const last = clips[clips.length - 1];
        if (last) v.currentTime = last.end;
      } else if (typeof action === "number") {
        v.currentTime = action;
      }
      setCurrentTime(v.currentTime);
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTimeUpdate);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [videoRef, clips]);

  return { currentTime, playing, play, pause, seekToSource };
}
