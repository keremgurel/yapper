"use client";

import { Eye, EyeOff, Film, Trash2, Volume2, VolumeX } from "lucide-react";
import type { AudioTrack, Overlay } from "@/lib/studio/types";

const btn =
  "text-foreground/50 hover:text-foreground transition-colors disabled:opacity-30";

/**
 * Fixed left rail of per-track controls (hide / mute / delete), aligned to the
 * timeline lanes and pinned so they never scroll horizontally — CapCut-style.
 * Order matches the timeline: upper video tracks (top-most first), base, audio.
 */
export default function TrackHeaderRail({
  overlays,
  audioTracks,
  onToggleOverlayHidden,
  onToggleOverlayMuted,
  onRemoveOverlay,
  onToggleAudioMuted,
  onRemoveAudio,
}: {
  overlays: Overlay[];
  audioTracks: AudioTrack[];
  onToggleOverlayHidden: (id: string) => void;
  onToggleOverlayMuted: (id: string) => void;
  onRemoveOverlay: (id: string) => void;
  onToggleAudioMuted: (id: string) => void;
  onRemoveAudio: (id: string) => void;
}) {
  return (
    <div className="border-border bg-card/40 w-9 shrink-0 overflow-hidden border-r">
      {/* Ruler spacer keeps the first track aligned with the timeline. */}
      <div className="h-5" />
      <div className="space-y-1 py-1">
        {[...overlays].reverse().map((o) => {
          const muted = o.muted ?? true;
          return (
            <div
              key={o.id}
              className="flex h-16 flex-col items-center justify-center gap-2"
            >
              <button
                type="button"
                onClick={() => onToggleOverlayHidden(o.id)}
                className={btn}
                aria-label={o.hidden ? "Show track" : "Hide track"}
              >
                {o.hidden ? (
                  <EyeOff className="h-3.5 w-3.5" />
                ) : (
                  <Eye className="h-3.5 w-3.5" />
                )}
              </button>
              {o.kind === "video" && (
                <button
                  type="button"
                  onClick={() => onToggleOverlayMuted(o.id)}
                  className={btn}
                  aria-label={muted ? "Unmute track" : "Mute track"}
                >
                  {muted ? (
                    <VolumeX className="h-3.5 w-3.5" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveOverlay(o.id)}
                className={`${btn} hover:!text-red-400`}
                aria-label="Delete track"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}

        {/* Base (main) video track */}
        <div className="text-foreground/30 flex h-20 items-center justify-center">
          <Film className="h-4 w-4" />
        </div>

        {audioTracks.map((a) => (
          <div
            key={a.id}
            className="flex h-12 flex-col items-center justify-center gap-2"
          >
            <button
              type="button"
              onClick={() => onToggleAudioMuted(a.id)}
              className={btn}
              aria-label={a.muted ? "Unmute track" : "Mute track"}
            >
              {a.muted ? (
                <VolumeX className="h-3.5 w-3.5" />
              ) : (
                <Volume2 className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemoveAudio(a.id)}
              className={`${btn} hover:!text-red-400`}
              aria-label="Delete track"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
