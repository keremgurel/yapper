"use client";

import { useEffect, useRef } from "react";
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
      const local = masterTime - t.start;
      const active = playing && !t.muted && local >= 0 && local < t.duration;
      if (active) {
        if (Math.abs(el.currentTime - local) > 0.12) el.currentTime = local;
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
