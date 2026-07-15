"use client";

import { useEffect, useRef } from "react";
import { audioCue } from "@/lib/studio/audio-cue";
import type { AudioTrack } from "@/lib/studio/types";

/**
 * Hidden <audio> elements for the audio tracks, kept in sync with the master
 * (edited-timeline) clock so they mix under the video during playback.
 */
export default function AudioTracksPlayer({
  tracks,
  masterTime,
  playing,
}: {
  tracks: AudioTrack[];
  masterTime: number;
  playing: boolean;
}) {
  const refs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    for (const t of tracks) {
      const el = refs.current.get(t.id);
      if (!el) continue;
      const { active, target } = audioCue(t, masterTime, playing);
      if (active) {
        // Seeking before metadata loads is silently dropped, so a trimmed clip
        // (target > 0) would start from 0, i.e. the wrong seconds. Wait for
        // HAVE_METADATA; playback ticks re-run this effect, so a not-yet-ready
        // track just joins a frame or two late at the right position. Mirrors
        // the overlay <video>'s readiness gate.
        if (el.readyState < 1) continue;
        if (Math.abs(el.currentTime - target) > 0.12) el.currentTime = target;
        if (el.paused) void el.play().catch(() => {});
      } else if (!el.paused) {
        el.pause();
      }
    }
  }, [tracks, masterTime, playing]);

  return (
    <div className="hidden">
      {tracks.map((t) => (
        <audio
          key={t.id}
          src={t.url}
          preload="auto"
          ref={(el) => {
            if (el) refs.current.set(t.id, el);
            else refs.current.delete(t.id);
          }}
        />
      ))}
    </div>
  );
}
