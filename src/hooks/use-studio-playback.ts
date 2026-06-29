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
 * Drives a <video> with the *edited timeline* as the master clock: clips play in
 * array order, so reordered or out-of-source-order clips play correctly. At each
 * clip boundary the video seeks to the next clip's source start. Returns the
 * timeline position (for the playhead/overlays), the raw source time (for split
 * and transcript highlighting), and transport helpers.
 */
export function useStudioPlayback(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  clips: Clip[],
) {
  const [timelineTime, setTimelineTime] = useState(0);
  const [sourceTime, setSourceTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const activeIndexRef = useRef(0);
  const total = totalDuration(clips);

  // Position the video (and our clocks) at a given timeline time.
  const applyTimeline = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(t, total));
      const hit = timelineToClip(clips, clamped);
      setTimelineTime(clamped);
      const v = videoRef.current;
      if (!hit || !v) return;
      activeIndexRef.current = hit.index;
      v.currentTime = hit.sourceTime;
      setSourceTime(hit.sourceTime);
    },
    [videoRef, clips, total],
  );

  const seekToTimeline = useCallback(
    (t: number) => applyTimeline(t),
    [applyTimeline],
  );

  // Jump to where a given source time lives in the edited sequence.
  const seekToSource = useCallback(
    (s: number) => {
      const found = sourceToTimelineSeq(clips, s);
      applyTimeline(found ? found.timeline : 0);
    },
    [clips, applyTimeline],
  );

  const play = useCallback(() => {
    const v = videoRef.current;
    if (!v || clips.length === 0) return;
    // Align the video to the timeline clock before playing so reordered clips
    // start from the right source position (restart if we're at the end).
    applyTimeline(timelineTime >= total - EPS ? 0 : timelineTime);
    void v.play();
  }, [videoRef, clips, total, timelineTime, applyTimeline]);

  const pause = useCallback(() => videoRef.current?.pause(), [videoRef]);

  useEffect(() => {
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
  }, [videoRef, clips, total]);

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
