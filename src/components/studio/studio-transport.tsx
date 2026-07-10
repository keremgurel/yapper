"use client";

import {
  Loader2,
  Magnet,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  Trash2,
  Undo2,
  Volume2,
  Wand2,
} from "lucide-react";
import ExportButton from "@/components/studio/export/export-button";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/components/studio/studio-context";

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function StudioTransport({
  playing,
  currentTimelineTime,
  totalTimelineTime,
  onPlay,
  onPause,
  onSplit,
}: {
  playing: boolean;
  currentTimelineTime: number;
  totalTimelineTime: number;
  onPlay: () => void;
  onPause: () => void;
  onSplit: () => void;
}) {
  const {
    source,
    selectedClipIds,
    selectedOverlayIds,
    selectedCaptionIds,
    deleteSelected,
    trimClipsToSpeech,
    detecting,
    autoEdit,
    autoEditing,
    snapping,
    toggleSnapping,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  } = useStudio();
  const canAutoEdit = !!source && source.kind !== "image";
  const divider = "bg-border mx-1 h-5 w-px shrink-0";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        onClick={playing ? onPause : onPlay}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-px" />
        )}
      </Button>
      <span className="text-foreground/60 mx-1 font-mono text-xs tabular-nums">
        {fmt(currentTimelineTime)} / {fmt(totalTimelineTime)}
      </span>

      <ExportButton />
      <span className={divider} aria-hidden />

      {canAutoEdit && (
        <>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void autoEdit(true)}
            disabled={autoEditing}
            title="Transcribe, remove mistakes, cut pauses and silences, and add captions — in one click"
          >
            {autoEditing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            {autoEditing ? "Editing…" : "1-Click + Captions"}
          </Button>
          <span className={divider} aria-hidden />
        </>
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (⌘/Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (⌘/Ctrl+Shift+Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
        Redo
      </Button>

      <span className={divider} aria-hidden />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={toggleSnapping}
        aria-pressed={snapping}
        title="Magnet (snap clips to edges)"
        className={
          snapping
            ? "bg-[color:var(--sg-accent)]/15 text-[color:var(--sg-accent)] hover:bg-[color:var(--sg-accent)]/20 hover:text-[color:var(--sg-accent)]"
            : undefined
        }
      >
        <Magnet className="h-3.5 w-3.5" />
        Magnet
      </Button>

      <Button type="button" variant="ghost" size="sm" onClick={onSplit}>
        <Scissors className="h-3.5 w-3.5" />
        Split
      </Button>
      {(() => {
        const count =
          selectedClipIds.length +
          selectedOverlayIds.length +
          selectedCaptionIds.length;
        return (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={deleteSelected}
            disabled={count === 0}
            title="Delete the selected clips, overlays, or captions"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {count > 1 ? `Delete ${count}` : "Delete"}
          </Button>
        );
      })()}
      {source?.kind !== "image" && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void trimClipsToSpeech()}
          disabled={detecting}
          title="Trim each clip's start and end down to speech"
        >
          <Volume2 className="h-3.5 w-3.5" />
          {detecting ? "Scanning…" : "Trim silence"}
        </Button>
      )}
      <Button type="button" variant="ghost" size="sm" onClick={reset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
    </div>
  );
}
