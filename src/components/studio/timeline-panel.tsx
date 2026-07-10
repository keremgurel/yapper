"use client";

import { useState } from "react";
import { useStudio } from "@/components/studio/studio-context";
import AspectPicker from "@/components/studio/aspect-picker";
import EmptyTimeline from "@/components/studio/empty-timeline";
import LayoutPicker from "@/components/studio/layout-picker";
import StudioTimeline from "@/components/studio/studio-timeline";
import StudioTransport from "@/components/studio/studio-transport";
import { MEDIA_DND_TYPE } from "@/components/studio/media-tab";
import type { LayoutId } from "@/lib/studio/layout";

/**
 * The transport, the pickers, and the tracks: everything below the picture.
 * It knows nothing about where it sits, so either layout can place it.
 */
export default function TimelinePanel({
  timelineTime,
  playing,
  onPlay,
  onPause,
  onSeek,
  layout,
  onLayout,
}: {
  timelineTime: number;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timelineTime: number) => void;
  layout: LayoutId;
  onLayout: (id: LayoutId) => void;
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
    <div className="border-border bg-card flex h-full min-h-0 flex-col rounded-xl border px-4 pt-2 pb-3">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
        <p className="text-foreground/55 truncate text-xs">
          {source?.name ?? "No video yet"}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <LayoutPicker layout={layout} onChange={onLayout} />
          <AspectPicker />
        </div>
      </div>
      <div className="shrink-0">
        <StudioTransport
          playing={playing}
          currentTimelineTime={timelineTime}
          totalTimelineTime={duration}
          onPlay={onPlay}
          onPause={onPause}
          onSplit={() => splitSelected(timelineTime)}
        />
      </div>
      <div
        className={`mt-3 min-h-0 flex-1 rounded-md transition-shadow ${
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
            onSeek={onSeek}
          />
        ) : (
          <EmptyTimeline />
        )}
      </div>
    </div>
  );
}
