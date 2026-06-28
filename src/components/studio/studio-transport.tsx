"use client";

import { useRef } from "react";
import {
  Magnet,
  Music2,
  Pause,
  Play,
  Redo2,
  RotateCcw,
  Scissors,
  Trash2,
  Undo2,
  Volume2,
  X,
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
    selectedClipId,
    deleteSelected,
    removeSilences,
    detecting,
    addAudio,
    snapping,
    toggleSnapping,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clearSource,
  } = useStudio();
  const audioInputRef = useRef<HTMLInputElement>(null);

  const pillBtn =
    "border-border text-foreground/80 hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-bold transition-colors disabled:opacity-40";

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
        disabled={!selectedClipId}
        className={pillBtn}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Delete clip
      </button>
      <button
        type="button"
        onClick={() => void removeSilences()}
        disabled={detecting}
        className={pillBtn}
      >
        <Volume2 className="h-3.5 w-3.5" />
        {detecting ? "Scanning…" : "Remove silences"}
      </button>
      <button
        type="button"
        onClick={() => audioInputRef.current?.click()}
        className={pillBtn}
      >
        <Music2 className="h-3.5 w-3.5" />
        Add audio
      </button>
      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void addAudio(file);
          e.target.value = "";
        }}
      />
      <button type="button" onClick={reset} className={pillBtn}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>
      <button type="button" onClick={clearSource} className={pillBtn}>
        <X className="h-3.5 w-3.5" />
        New video
      </button>
    </div>
  );
}
