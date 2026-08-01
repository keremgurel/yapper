"use client";

import { useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import AspectPicker from "@/components/studio/aspect-picker";
import EmptyTimeline from "@/components/studio/empty-timeline";
import StudioTimeline from "@/components/studio/studio-timeline";
import StudioTransport from "@/components/studio/studio-transport";
import { MEDIA_DND_TYPE } from "@/components/studio/media-tab";
import type { TimelineClock } from "@/lib/studio/timeline-clock";

/**
 * The transport, the pickers, and the tracks: everything below the picture.
 * It knows nothing about where it sits, so either layout can place it.
 */
export default function TimelinePanel({
  timelineTime,
  timelineClock,
  playing,
  onPlay,
  onPause,
  onSeek,
}: {
  timelineTime: number;
  /** Per-frame playhead time; the playhead line subscribes to this directly
   * instead of re-rendering on `timelineTime`. */
  timelineClock: TimelineClock;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timelineTime: number) => void;
}) {
  const {
    source,
    clips,
    duration,
    overlays,
    audioTracks,
    addAssetToTimeline,
    splitSelected,
  } = useStudio();
  const [dropActive, setDropActive] = useState(false);

  const hasProject =
    !!source ||
    clips.length > 0 ||
    overlays.length > 0 ||
    audioTracks.length > 0;

  return (
    <section
      aria-label="Timeline"
      className="border-border bg-card flex h-full min-h-0 flex-col border-t"
    >
      <div className="border-border flex min-h-11 shrink-0 items-center gap-3 border-b px-3 py-1.5">
        <p
          className="text-foreground/45 hidden max-w-40 truncate text-[10px] font-medium xl:block"
          title={source?.name ?? "Untitled project"}
        >
          {source?.name ?? "Untitled project"}
        </p>
        <StudioTransport
          playing={playing}
          currentTimelineTime={timelineTime}
          totalTimelineTime={duration}
          onPlay={onPlay}
          onPause={onPause}
          onSplit={() => splitSelected(timelineTime)}
        />
        <div className="ml-auto shrink-0">
          <AspectPicker />
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 overflow-hidden p-2 transition-shadow ${
          dropActive ? "ring-2 ring-cyan-500/70" : ""
        }`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(MEDIA_DND_TYPE)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDropActive(true);
          }
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          const id = e.dataTransfer.getData(MEDIA_DND_TYPE);
          setDropActive(false);
          if (id) {
            e.preventDefault();
            addAssetToTimeline(id, timelineTime);
          }
        }}
      >
        {hasProject ? (
          <StudioTimeline
            clips={clips}
            source={source}
            currentTimelineTime={timelineTime}
            timelineClock={timelineClock}
            onSeek={onSeek}
          />
        ) : (
          <EmptyTimeline />
        )}
      </div>
    </section>
  );
}
