"use client";

import { useCallback, useRef, useState } from "react";
import { captureFrame, seekVideo } from "./frame-capture";
import { FRAME_SECONDS, clampTime, snapToFrame } from "./frame-time";

/**
 * The scrub position, the video element it drives, and the one action that
 * matters: capturing the frame under the playhead.
 */
export function useFramePicker(initialTime: number) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(initialTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // `within` lets the caller seek in the same tick the duration arrives, before
  // the state update has landed.
  const seek = useCallback(
    (next: number, within: number = duration) => {
      const bounded = clampTime(snapToFrame(next), within);
      setTime(bounded);
      const video = videoRef.current;
      if (video && Math.abs(video.currentTime - bounded) > 0.002) {
        video.currentTime = bounded;
      }
      return bounded;
    },
    [duration],
  );

  const step = useCallback(
    (frames: number) => seek(time + frames * FRAME_SECONDS),
    [seek, time],
  );

  /** The frame at `at` (default: the playhead) as a data URL, or null. */
  const capture = useCallback(
    async (at: number = time): Promise<string | null> => {
      const video = videoRef.current;
      if (!video) return null;
      setBusy(true);
      setError("");
      try {
        await seekVideo(video, clampTime(at, duration || video.duration || 0));
        return captureFrame(video);
      } catch {
        setError("That frame could not be captured. Try the next one.");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [duration, time],
  );

  return {
    videoRef,
    duration,
    setDuration,
    time,
    seek,
    step,
    capture,
    busy,
    error,
  };
}
