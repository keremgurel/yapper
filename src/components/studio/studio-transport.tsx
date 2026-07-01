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

  const pillBtn =
    "border-border text-foreground/80 hover:bg-muted hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors disabled:cursor-default disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={playing ? onPause : onPlay}
        className="bg-foreground text-background inline-flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-90"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4 translate-x-px" />
        )}
      </button>
      <span className="text-foreground/60 mr-1 font-mono text-xs tabular-nums">
        {fmt(currentTimelineTime)} / {fmt(totalTimelineTime)}
      </span>

      {canAutoEdit && (
        <button
          type="button"
          onClick={() => void autoEdit()}
          disabled={autoEditing}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 px-3.5 py-2 text-xs font-black text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          title="Transcribe, remove mistakes, cut pauses and silences, and caption — in one click"
        >
          {autoEditing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          {autoEditing ? "Editing…" : "Auto-edit"}
        </button>
      )}

      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        className={pillBtn}
        title="Undo (⌘/Ctrl+Z)"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        className={pillBtn}
        title="Redo (⌘/Ctrl+Shift+Z)"
      >
        <Redo2 className="h-3.5 w-3.5" />
        Redo
      </button>

      <button
        type="button"
        onClick={toggleSnapping}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${
          snapping
            ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
            : "border-border text-foreground/80 hover:bg-muted hover:text-foreground"
        }`}
        title="Magnet (snap clips to edges)"
        aria-pressed={snapping}
      >
        <Magnet className="h-3.5 w-3.5" />
        Magnet
      </button>

      <button type="button" onClick={onSplit} className={pillBtn}>
        <Scissors className="h-3.5 w-3.5" />
        Split
      </button>
      <button
        type="button"
        onClick={deleteSelected}
        disabled={selectedClipIds.length === 0}
        className={pillBtn}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {selectedClipIds.length > 1
          ? `Delete ${selectedClipIds.length} clips`
          : "Delete clip"}
      </button>
      {source?.kind !== "image" && (
        <button
          type="button"
          onClick={() => void trimClipsToSpeech()}
          disabled={detecting}
          className={pillBtn}
          title="Trim each clip's start and end down to speech"
        >
          <Volume2 className="h-3.5 w-3.5" />
          {detecting ? "Scanning…" : "Trim silence"}
        </button>
      )}
      <button type="button" onClick={reset} className={pillBtn}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>
    </div>
  );
}
