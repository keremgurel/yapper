"use client";

import { useEffect, useRef } from "react";
import AiAssistant from "@/components/studio/ai-assistant";
import EditorWorkbench from "@/components/studio/editor-workbench";
import { useStudio } from "@/components/studio/studio-context";
import PreviewStage from "@/components/studio/preview-stage";
import TimelinePanel from "@/components/studio/timeline-panel";
import { useEditorWorkspaceLayout } from "@/hooks/use-editor-workspace-layout";
import { useStudioPlayback } from "@/hooks/use-studio-playback";
import { useNativeEditPreview } from "@/hooks/use-native-edit-preview";
import { transportSeek } from "@/lib/studio/playback-keys";
import { nudgeDelta } from "@/lib/studio/nudge";

function ResizeDivider({
  axis,
  value,
  onPointerDown,
  onAdjust,
  onReset,
}: {
  axis: "horizontal" | "vertical";
  value: number;
  onPointerDown: (event: React.PointerEvent) => void;
  onAdjust: (delta: number) => void;
  onReset: () => void;
}) {
  const vertical = axis === "vertical";
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={vertical ? "Resize Workbench" : "Resize Timeline"}
      aria-orientation={axis}
      aria-valuenow={Math.round(value)}
      onPointerDown={onPointerDown}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const decrease = vertical
          ? event.key === "ArrowLeft"
          : event.key === "ArrowDown";
        const increase = vertical
          ? event.key === "ArrowRight"
          : event.key === "ArrowUp";
        if (!decrease && !increase) return;
        event.preventDefault();
        onAdjust((increase ? 1 : -1) * (event.shiftKey ? 40 : 10));
      }}
      className={`group relative z-20 h-full w-full shrink-0 touch-none bg-[color:var(--sg-bg-2)] focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:ring-inset ${vertical ? "cursor-col-resize" : "cursor-row-resize"}`}
      title="Drag to resize · double-click to reset"
    >
      <span
        aria-hidden="true"
        className={`bg-border absolute transition-colors group-hover:bg-[color:var(--sg-accent)] ${vertical ? "inset-y-0 left-1/2 w-px -translate-x-1/2" : "inset-x-0 top-1/2 h-px -translate-y-1/2"}`}
      />
    </div>
  );
}

/**
 * The editor's shell. It owns the master clock and the keyboard, and arranges
 * three persistent surfaces: Workbench, Preview, and Timeline. Resizing changes
 * their grid dimensions without remounting the media elements.
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
  const continuousPreview = useNativeEditPreview(clips, source, aspect);
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
    continuousPreviewUrl: continuousPreview.url,
    continuousPreviewPending: continuousPreview.preparing,
  });
  const workspace = useEditorWorkspaceLayout();

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
      playbackPreparing={continuousPreview.preparing}
      playbackFailed={continuousPreview.failed}
    />
  );

  const assistant = <AiAssistant />;

  return (
    <div className="flex min-h-0 flex-1">
      <div
        className="grid min-h-0 min-w-0 flex-1"
        style={{
          gridTemplateColumns: `${workspace.workbenchWidth}px 6px minmax(0, 1fr)`,
          gridTemplateRows: `minmax(0, 1fr) 6px ${workspace.timelineHeight}px`,
        }}
      >
        <aside
          className="border-border min-h-0 min-w-0 overflow-hidden border-r"
          style={{ gridColumn: "1", gridRow: "1 / 4" }}
        >
          <EditorWorkbench
            currentTimelineTime={timelineTime}
            onSeek={seekToSource}
            onSeekTimeline={seekToTimeline}
          />
        </aside>

        <div style={{ gridColumn: "2", gridRow: "1 / 4" }}>
          <ResizeDivider
            axis="vertical"
            value={workspace.workbenchWidth}
            onPointerDown={workspace.startWorkbenchResize}
            onAdjust={workspace.adjustWorkbench}
            onReset={workspace.resetWorkbench}
          />
        </div>

        <section
          aria-label="Preview"
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
          style={{ gridColumn: "3", gridRow: "1" }}
        >
          <div className="border-border flex h-10 shrink-0 items-center border-b px-3">
            <h2 className="text-foreground/70 text-[11px] font-bold">
              Preview
            </h2>
          </div>
          <div className="flex min-h-0 flex-1">{stage}</div>
        </section>

        <div style={{ gridColumn: "3", gridRow: "2" }}>
          <ResizeDivider
            axis="horizontal"
            value={workspace.timelineHeight}
            onPointerDown={workspace.startTimelineResize}
            onAdjust={workspace.adjustTimeline}
            onReset={workspace.resetTimeline}
          />
        </div>

        <div
          className="min-h-0 min-w-0 overflow-hidden"
          style={{ gridColumn: "3", gridRow: "3" }}
        >
          <TimelinePanel
            timelineTime={timelineTime}
            timelineClock={timelineClock}
            playing={playing}
            onPlay={play}
            onPause={pause}
            onSeek={seekToTimeline}
            playbackPreparing={continuousPreview.preparing}
          />
        </div>
      </div>
      {assistant}
    </div>
  );
}
