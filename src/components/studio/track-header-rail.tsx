"use client";

import { Captions, Plus } from "lucide-react";
import TrackControls from "@/components/studio/track-controls";
import { overlaysOnTrack } from "@/lib/studio/tracks";
import type { AudioTrack, Overlay } from "@/lib/studio/types";

/**
 * Fixed left rail of per-track controls (hide / mute / delete), aligned to the
 * timeline lanes and pinned so they never scroll horizontally — CapCut-style.
 * Order matches the timeline: the empty lane waiting for a new track, the upper
 * video tracks (top-most first), the bottom video track, then audio. Every video
 * track gets the same three controls; the bottom one is not privileged, it just
 * renders underneath the rest.
 */
export default function TrackHeaderRail({
  scrollRef,
  overlays,
  lanes,
  audioTracks,
  hasBaseTrack,
  baseHidden,
  baseMuted,
  hasCaptions = false,
  onToggleTrackHidden,
  onToggleTrackMuted,
  onRemoveTrack,
  onToggleBaseHidden,
  onToggleBaseMuted,
  onRemoveBaseTrack,
  onToggleAudioMuted,
  onRemoveAudio,
}: {
  /** Scrolled vertically in lockstep with the lanes, which own the scrollbar. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  overlays: Overlay[];
  /** Upper-track indices, top to bottom. The first is the empty new-track lane. */
  lanes: number[];
  audioTracks: AudioTrack[];
  hasBaseTrack: boolean;
  baseHidden: boolean;
  baseMuted: boolean;
  hasCaptions?: boolean;
  onToggleTrackHidden: (track: number) => void;
  onToggleTrackMuted: (track: number) => void;
  onRemoveTrack: (track: number) => void;
  onToggleBaseHidden: () => void;
  onToggleBaseMuted: () => void;
  onRemoveBaseTrack: () => void;
  onToggleAudioMuted: (id: string) => void;
  onRemoveAudio: (id: string) => void;
}) {
  return (
    <div
      ref={scrollRef}
      className="border-border bg-card/40 w-24 shrink-0 overflow-hidden border-r"
    >
      {/* Ruler spacer keeps the first track aligned with the timeline. */}
      <div className="h-5" />
      <div className="space-y-1 py-1">
        {hasCaptions && (
          <div className="text-foreground/45 flex h-7 items-center gap-1.5 px-2">
            <Captions className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[10px] font-bold">Captions</span>
          </div>
        )}

        {lanes.map((track) => {
          const on = overlaysOnTrack(overlays, track);
          if (on.length === 0) {
            return (
              <div
                key={track}
                className="text-foreground/25 flex h-12 items-center gap-1.5 px-2"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[10px] font-bold">Add track</span>
              </div>
            );
          }
          return (
            <div
              key={track}
              className="flex h-12 items-center justify-center gap-2 px-1.5"
            >
              <TrackControls
                hidden={on.every((o) => o.hidden)}
                muted={on.every((o) => o.muted ?? true)}
                onToggleHidden={() => onToggleTrackHidden(track)}
                onToggleMuted={
                  on.some((o) => o.kind === "video")
                    ? () => onToggleTrackMuted(track)
                    : undefined
                }
                onRemove={() => onRemoveTrack(track)}
              />
            </div>
          );
        })}

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
