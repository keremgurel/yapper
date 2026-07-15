"use client";

import { useEffect, useRef } from "react";
import AiAssistant from "@/components/studio/ai-assistant";
import { useStudio } from "@/components/studio/studio-context";
import PreviewStage from "@/components/studio/preview-stage";
import RightPanel from "@/components/studio/right-panel";
import TimelinePanel from "@/components/studio/timeline-panel";
import { useStudioPlayback } from "@/hooks/use-studio-playback";
import { transportSeek } from "@/lib/studio/playback-keys";
import { usePanelHeight } from "@/hooks/use-panel-height";
import { useResizablePanel } from "@/hooks/use-resizable-panel";
import { useStudioLayout } from "@/hooks/use-studio-layout";

/** The gap between the timeline card and everything around it. */
const CARD_GUTTER = "px-3 pb-3";

function RowHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center"
    >
      <span className="bg-foreground/20 group-hover:bg-foreground/40 h-0.5 w-10 rounded-full transition-colors" />
    </div>
  );
}

function ColHandle({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="bg-border hover:bg-foreground/30 hidden w-1 shrink-0 cursor-col-resize transition-colors lg:block"
      role="separator"
      aria-orientation="vertical"
    />
  );
}

/**
 * The editor's shell. It owns the master clock and the keyboard, and arranges
 * three panes: the picture, the tracks, and the side panel. Where those panes
 * go is the layout's business and nothing else's.
 */
export default function StudioWorkspace() {
  const {
    source,
    clips,
    duration,
    selectedClipIds,
    selectedCaptionIds,
    selectedOverlayIds,
    selectedAudioIds,
    splitSelected,
    deleteSelected,
    clearSelection,
    duplicateSelectedOverlays,
    undo,
    redo,
  } = useStudio();
  const videoRef = useRef<HTMLVideoElement>(null);
  // The bottom track can drive a <video> clock only when it has clips and isn't
  // a still. Otherwise playback falls back to its synthetic clock.
  const hasVideo = clips.length > 0 && (source?.kind ?? "video") !== "image";
  const {
    timelineTime,
    sourceTime,
    playing,
    play,
    pause,
    seekToTimeline,
    seekToSource,
  } = useStudioPlayback(videoRef, {
    clips,
    total: duration,
    hasVideo,
    baseUrl: source?.url ?? "",
  });
  // Two docked widths, because the two layouts dock two different things: the
  // side panel in classic, the picture in cinema. Sharing one would make the
  // preview open at a panel's width the moment you switched.
  const side = useResizablePanel();
  const preview = useResizablePanel(560, 360, 1200);
  const { height, onResizeDown } = usePanelHeight(380);
  const { layout, setLayout } = useStudioLayout();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d") {
        // Duplicate the selected overlays. Only claim the shortcut when there is
        // something to copy, so it falls through to the browser otherwise.
        if (selectedOverlayIds.length) {
          e.preventDefault();
          duplicateSelectedOverlays();
        }
      } else if (e.key === " ") {
        // Key off playback state, not the <video> element — image-base projects
        // have no <video>, so an element check would make Space a no-op there.
        e.preventDefault();
        if (playing) pause();
        else play();
      } else if (e.key.toLowerCase() === "s" && !mod) {
        // Timeline seconds, not the <video>'s own clock: the playhead is the one
        // position every layer shares, and only the bottom track has a <video>.
        e.preventDefault();
        splitSelected(timelineTime);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // One delete for everything selected — base clips, overlays, captions,
        // or any mix of them.
        if (
          selectedClipIds.length ||
          selectedOverlayIds.length ||
          selectedCaptionIds.length ||
          selectedAudioIds.length
        ) {
          e.preventDefault();
          deleteSelected();
        }
      } else if (e.key === "Escape") {
        // Clear whatever is highlighted. Only swallow Escape when there is a
        // selection, so it still closes menus and popovers otherwise.
        if (
          selectedClipIds.length ||
          selectedOverlayIds.length ||
          selectedCaptionIds.length ||
          selectedAudioIds.length
        ) {
          e.preventDefault();
          clearSelection();
        }
      } else {
        // Transport: arrows step the playhead (a second with Shift), Home/End
        // jump to the ends. A seek during playback keeps playing from the new
        // spot; pause first (Space) to step frame by frame.
        const target = transportSeek(e.key, timelineTime, duration, e.shiftKey);
        if (target == null) return;
        e.preventDefault();
        seekToTimeline(target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    undo,
    redo,
    play,
    pause,
    playing,
    timelineTime,
    duration,
    seekToTimeline,
    splitSelected,
    deleteSelected,
    clearSelection,
    duplicateSelectedOverlays,
    selectedClipIds,
    selectedCaptionIds,
    selectedOverlayIds,
    selectedAudioIds,
  ]);

  const stage = (
    <PreviewStage
      videoRef={videoRef}
      timelineTime={timelineTime}
      playing={playing}
      onTogglePlay={() => (playing ? pause() : play())}
    />
  );

  const timeline = (
    <div style={{ height }} className={`shrink-0 ${CARD_GUTTER}`}>
      <TimelinePanel
        timelineTime={timelineTime}
        playing={playing}
        onPlay={play}
        onPause={pause}
        onSeek={seekToTimeline}
        layout={layout}
        onLayout={setLayout}
      />
    </div>
  );

  const assistant = <AiAssistant />;

  const panel = (
    <RightPanel
      currentSourceTime={sourceTime}
      onSeek={seekToSource}
      onSeekTimeline={seekToTimeline}
    />
  );

  // Cinema: a tall picture down the right, with the panels and the tracks
  // stacked beside it. Worth it for a 9:16 project, where a wide preview pane
  // is mostly empty space either side of the frame.
  if (layout === "cinema") {
    return (
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:order-last">
          <div className="min-h-0 flex-1 overflow-hidden">{panel}</div>
          <RowHandle onPointerDown={onResizeDown} />
          {timeline}
        </div>
        <ColHandle onPointerDown={preview.onPointerDown} />
        <aside
          style={{ width: preview.width }}
          className="border-border flex min-h-0 shrink-0 flex-col border-l max-lg:!h-[50vh] max-lg:!w-full max-lg:border-l-0"
        >
          {stage}
        </aside>
        {assistant}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {stage}
        <RowHandle onPointerDown={onResizeDown} />
        {timeline}
      </div>
      <ColHandle onPointerDown={side.onPointerDown} />
      <aside
        style={{ width: side.width }}
        className="border-border flex min-h-0 shrink-0 flex-col border-t max-lg:!h-[44vh] max-lg:!w-full lg:border-t-0 lg:border-l"
      >
        {panel}
      </aside>
      {assistant}
    </div>
  );
}
