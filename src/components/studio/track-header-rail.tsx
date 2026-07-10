"use client";

import {
  Captions,
  Eye,
  EyeOff,
  Film,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
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
  placeholderTrack = false,
  hasCaptions = false,
  onToggleOverlayHidden,
  onToggleOverlayMuted,
  onRemoveOverlay,
  onToggleAudioMuted,
  onRemoveAudio,
}: {
  overlays: Overlay[];
  audioTracks: AudioTrack[];
  placeholderTrack?: boolean;
  hasCaptions?: boolean;
  onToggleOverlayHidden: (id: string) => void;
  onToggleOverlayMuted: (id: string) => void;
  onRemoveOverlay: (id: string) => void;
  onToggleAudioMuted: (id: string) => void;
  onRemoveAudio: (id: string) => void;
}) {
  return (
    <div className="border-border bg-card/40 w-24 shrink-0 overflow-hidden border-r">
      {/* Ruler spacer keeps the first track aligned with the timeline. */}
      <div className="h-5" />
      <div className="space-y-1 py-1">
        {hasCaptions && (
          <div className="text-foreground/45 flex h-7 items-center gap-1.5 px-2">
            <Captions className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-bold">Captions</span>
          </div>
        )}
        {placeholderTrack && (
          <div className="text-foreground/25 flex h-12 items-center gap-1.5 px-2">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-bold">Add track</span>
          </div>
        )}
        {[...overlays].reverse().map((o) => {
          const muted = o.muted ?? true;
          return (
            <div
              key={o.id}
              className="flex h-12 items-center justify-center gap-2 px-1.5"
            >
              <button
                type="button"
                onClick={() => onToggleOverlayHidden(o.id)}
                className={btn}
                title={o.hidden ? "Show track" : "Hide track"}
                aria-label={o.hidden ? "Show track" : "Hide track"}
              >
                {o.hidden ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
              {o.kind === "video" && (
                <button
                  type="button"
                  onClick={() => onToggleOverlayMuted(o.id)}
                  className={btn}
                  title={muted ? "Unmute track" : "Mute track"}
                  aria-label={muted ? "Unmute track" : "Mute track"}
                >
                  {muted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveOverlay(o.id)}
                className={`${btn} hover:!text-red-400`}
                title="Delete track"
                aria-label="Delete track"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}

        {/* Bottom layer — just the base of the stack; its only special role is
            setting the export aspect ratio. */}
        <div
          className="text-foreground/40 flex h-16 items-center gap-1.5 px-2"
          title="Bottom layer — sets the export ratio"
        >
          <Film className="h-4 w-4 shrink-0" />
          <span className="text-[10px] font-bold">Ratio</span>
        </div>

        {audioTracks.map((a) => (
          <div
            key={a.id}
            className="flex h-8 items-center justify-center gap-2 px-1.5"
          >
            <button
              type="button"
              onClick={() => onToggleAudioMuted(a.id)}
              className={btn}
              title={a.muted ? "Unmute track" : "Mute track"}
              aria-label={a.muted ? "Unmute track" : "Mute track"}
            >
              {a.muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onRemoveAudio(a.id)}
              className={`${btn} hover:!text-red-400`}
              title="Delete track"
              aria-label="Delete track"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
