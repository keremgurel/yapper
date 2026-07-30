"use client";

import { useEffect, useRef } from "react";
import AiAssistant from "@/components/studio/ai-assistant";
import { useStudio } from "@/components/studio/studio-context";
import PreviewStage from "@/components/studio/preview-stage";
import RightPanel from "@/components/studio/right-panel";
import TimelinePanel from "@/components/studio/timeline-panel";
import { useStudioPlayback } from "@/hooks/use-studio-playback";
import { useNativeEditPreview } from "@/hooks/use-native-edit-preview";
import { transportSeek } from "@/lib/studio/playback-keys";
import { nudgeDelta } from "@/lib/studio/nudge";
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
    aspect,
    baseMuted,
    selectedClipIds,
    selectedCaptionIds,
    selectedOverlayIds,
    selectedAudioIds,
    splitSelected,
    deleteSelected,
    clearSelection,
    duplicateSelectedOverlays,
    nudgeSelectedOverlay,
    undo,
    redo,
  } = useStudio();
  // Two persistent decoders let the next edited clip prepare before the
  // current one ends. A single <video> must flush and seek at every cut, which
  // is visibly discontinuous even when its `paused` state never changes.
  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([
    null,
    null,
  ]);
  // The bottom track can drive a <video> clock only when it has clips and isn't
  // a still. Otherwise playback falls back to its synthetic clock.
  const hasVideo = clips.length > 0 && (source?.kind ?? "video") !== "image";
  const continuousPreviewUrl = useNativeEditPreview(clips, source, aspect);
  const {
    timelineTime,
    timelineClock,
    playing,
    play,
    pause,
    seekToTimeline,
    seekToSource,
  } = useStudioPlayback(videoRefs, {
    clips,
    total: duration,
    hasVideo,
    baseUrl: source?.url ?? "",
    baseMuted,
    continuousPreviewUrl,
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
        splitSelected(timelineClock.get());
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
      } else if (
        nudgeDelta(e.key) &&
        selectedOverlayIds.length === 1 &&
        !selectedClipIds.length &&
        !selectedCaptionIds.length &&
        !selectedAudioIds.length
      ) {
        // A lone overlay is selected: arrows nudge its position on the stage
        // (a bigger step with Shift), the canvas-editor convention. Everything
        // else falls through to transport below.
        const delta = nudgeDelta(e.key)!;
        e.preventDefault();
        nudgeSelectedOverlay(delta.dx, delta.dy, e.shiftKey);
      } else {
        // Transport: arrows step the playhead (a second with Shift), Home/End
        // jump to the ends. A seek during playback keeps playing from the new
        // spot; pause first (Space) to step frame by frame.
        const target = transportSeek(
          e.key,
          timelineClock.get(),
          duration,
          e.shiftKey,
        );
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
    timelineClock,
    duration,
    seekToTimeline,
    splitSelected,
    deleteSelected,
    clearSelection,
    duplicateSelectedOverlays,
    nudgeSelectedOverlay,
    selectedClipIds,
    selectedCaptionIds,
    selectedOverlayIds,
    selectedAudioIds,
  ]);

  const stage = (
    <PreviewStage
      videoRefs={videoRefs}
      timelineTime={timelineTime}
      playing={playing}
      onTogglePlay={() => (playing ? pause() : play())}
    />
  );

  const timeline = (
    <div style={{ height }} className={`shrink-0 ${CARD_GUTTER}`}>
      <TimelinePanel
        timelineTime={timelineTime}
        timelineClock={timelineClock}
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
      currentTimelineTime={timelineTime}
      onSeek={seekToSource}
      onSeekTimeline={seekToTimeline}
      layout={layout}
    />
  );

  // One structure for both layouts. Classic docks the panel on the right with
  // the preview above the timeline; Cinema docks a tall preview on the right
  // with the panel and tracks beside it. Only each pane's GRID PLACEMENT changes
  // when you switch, never its position in the React tree, so the <video> is
  // never destroyed (which used to break playback and the transcript). Sized for
  // the desktop window.
  const stageInAside = layout === "cinema";
  const asideWidth = stageInAside ? preview.width : side.width;
  const onAsideResize = stageInAside
    ? preview.onPointerDown
    : side.onPointerDown;
  const stageCell = stageInAside
    ? { gridColumn: "3", gridRow: "1 / 4" }
    : { gridColumn: "1", gridRow: "1" };
  const panelCell = stageInAside
    ? { gridColumn: "1", gridRow: "1" }
    : { gridColumn: "3", gridRow: "1 / 4" };

  return (
    <div className="flex min-h-0 flex-1">
      <div
        className="grid min-h-0 min-w-0 flex-1"
        style={{
          gridTemplateColumns: `minmax(0,1fr) auto ${asideWidth}px`,
          gridTemplateRows: `minmax(0,1fr) auto ${height}px`,
        }}
      >
        <div
          className={`flex min-h-0 min-w-0 overflow-hidden ${stageInAside ? "border-border border-l" : ""}`}
          style={stageCell}
        >
          {stage}
        </div>
        <aside
          className={`flex min-h-0 min-w-0 flex-col overflow-hidden ${stageInAside ? "" : "border-border border-l"}`}
          style={panelCell}
        >
          {panel}
        </aside>
        <div style={{ gridColumn: "1", gridRow: "2" }}>
          <RowHandle onPointerDown={onResizeDown} />
        </div>
        <div
          className="min-h-0 min-w-0 overflow-hidden"
          style={{ gridColumn: "1", gridRow: "3" }}
        >
          {timeline}
        </div>
        <div className="flex" style={{ gridColumn: "2", gridRow: "1 / 4" }}>
          <ColHandle onPointerDown={onAsideResize} />
        </div>
      </div>
      {assistant}
    </div>
  );
}
