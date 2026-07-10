"use client";

import { Captions, Plus } from "lucide-react";
import TrackControls from "@/components/studio/track-controls";
import type { AudioTrack, Overlay } from "@/lib/studio/types";

/**
 * Fixed left rail of per-track controls (hide / mute / delete), aligned to the
 * timeline lanes and pinned so they never scroll horizontally — CapCut-style.
 * Order matches the timeline: upper video tracks (top-most first), the bottom
 * video track, then audio. Every video track gets the same three controls; the
 * bottom one is not privileged, it just renders underneath the rest.
 */
export default function TrackHeaderRail({
  overlays,
  audioTracks,
  hasBaseTrack,
  baseHidden,
  baseMuted,
  placeholderTrack = false,
  hasCaptions = false,
  onToggleOverlayHidden,
  onToggleOverlayMuted,
  onRemoveOverlay,
  onToggleBaseHidden,
  onToggleBaseMuted,
  onRemoveBaseTrack,
  onToggleAudioMuted,
  onRemoveAudio,
}: {
  overlays: Overlay[];
  audioTracks: AudioTrack[];
  hasBaseTrack: boolean;
  baseHidden: boolean;
  baseMuted: boolean;
  placeholderTrack?: boolean;
  hasCaptions?: boolean;
  onToggleOverlayHidden: (id: string) => void;
  onToggleOverlayMuted: (id: string) => void;
  onRemoveOverlay: (id: string) => void;
  onToggleBaseHidden: () => void;
  onToggleBaseMuted: () => void;
  onRemoveBaseTrack: () => void;
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
        {[...overlays].reverse().map((o) => (
          <div
            key={o.id}
            className="flex h-12 items-center justify-center gap-2 px-1.5"
          >
            <TrackControls
              hidden={o.hidden}
              muted={o.muted ?? true}
              onToggleHidden={() => onToggleOverlayHidden(o.id)}
              onToggleMuted={
                o.kind === "video"
                  ? () => onToggleOverlayMuted(o.id)
                  : undefined
              }
              onRemove={() => onRemoveOverlay(o.id)}
            />
          </div>
        ))}

        {/* Bottom video track. Same controls as any other video track. */}
        <div className="flex h-16 items-center justify-center gap-2 px-1.5">
          {hasBaseTrack && (
            <TrackControls
              hidden={baseHidden}
              muted={baseMuted}
              onToggleHidden={onToggleBaseHidden}
              onToggleMuted={onToggleBaseMuted}
              onRemove={onRemoveBaseTrack}
            />
          )}
        </div>

        {audioTracks.map((a) => (
          <div
            key={a.id}
            className="flex h-8 items-center justify-center gap-2 px-1.5"
          >
            <TrackControls
              muted={a.muted}
              onToggleMuted={() => onToggleAudioMuted(a.id)}
              onRemove={() => onRemoveAudio(a.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
