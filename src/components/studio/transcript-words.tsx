"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Eraser,
  Eye,
  EyeOff,
  Repeat2,
  Scissors,
  Trash2,
  X,
} from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { isWordCut } from "@/lib/studio/transcript-edit";

const MIN_GAP = 0.4; // seconds; shorter pauses aren't shown as chips

export default function TranscriptWords({
  currentSourceTime,
  onSeek,
}: {
  currentSourceTime: number;
  onSeek: (t: number) => void;
}) {
  const {
    words,
    clips,
    deleteWords,
    cutRange,
    removeFillers,
    removeEarlierTakes,
    removeSilences,
    detecting,
  } = useStudio();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(true);

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w, i) => m.set(w.id, i));
    return m;
  }, [words]);

  // The single active word under the playhead (latest match wins, so
  // overlapping Whisper timings don't light up two words at once).
  const activeId = useMemo(() => {
    for (let i = words.length - 1; i >= 0; i--) {
      const w = words[i];
      if (currentSourceTime >= w.start && currentSourceTime <= w.end) {
        return w.id;
      }
    }
    return null;
  }, [words, currentSourceTime]);

  const clearSelection = () => {
    setSelected(new Set());
    setAnchor(null);
  };

  const onWordClick = (id: string, e: React.MouseEvent) => {
    const word = words.find((w) => w.id === id);
    if (e.shiftKey && anchor) {
      const a = indexById.get(anchor) ?? 0;
      const b = indexById.get(id) ?? 0;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      setSelected(new Set(words.slice(lo, hi + 1).map((w) => w.id)));
    } else if (e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setAnchor(id);
    } else {
      setSelected(new Set([id]));
      setAnchor(id);
      if (word) onSeek(word.start);
    }
  };

  const applyDelete = () => {
    deleteWords([...selected]);
    clearSelection();
  };

  const toolBtn =
    "border-border text-foreground/80 hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors";

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <button
          type="button"
          onClick={() => void removeSilences()}
          disabled={detecting}
          className={toolBtn}
        >
          <Scissors className="h-3.5 w-3.5" />
          {detecting ? "Scanning…" : "Remove pauses"}
        </button>
        <button
          type="button"
          onClick={() => removeFillers()}
          className={toolBtn}
        >
          <Eraser className="h-3.5 w-3.5" />
          Remove fillers
        </button>
        <button
          type="button"
          onClick={() => removeEarlierTakes()}
          className={toolBtn}
        >
          <Repeat2 className="h-3.5 w-3.5" />
          Remove earlier takes
        </button>
        <button
          type="button"
          onClick={() => setShowDeleted((s) => !s)}
          className={`${toolBtn} ml-auto`}
          title={showDeleted ? "Hide deleted words" : "Show deleted words"}
        >
          {showDeleted ? (
            <EyeOff className="h-3.5 w-3.5" />
          ) : (
            <Eye className="h-3.5 w-3.5" />
          )}
          {showDeleted ? "Hide deleted" : "Show deleted"}
        </button>
      </div>

      {selected.size > 0 && (
        <div className="border-border bg-muted flex items-center justify-between gap-2 border-b px-4 py-2">
          <button
            type="button"
            onClick={applyDelete}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-black text-white transition-opacity hover:opacity-90"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete {selected.size} {selected.size === 1 ? "word" : "words"}
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="text-foreground/60 hover:text-foreground inline-flex items-center gap-1 text-xs font-bold"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-sm leading-8">
          {words.map((w, i) => {
            const cut = isWordCut(clips, w);
            const active = !cut && w.id === activeId;
            const isSel = selected.has(w.id);
            const next = words[i + 1];
            const gap =
              !cut && next && !isWordCut(clips, next) ? next.start - w.end : 0;
            if (cut && !showDeleted) return null;
            return (
              <Fragment key={w.id}>
                {cut ? (
                  <span className="text-foreground/30 px-0.5 line-through">
                    {w.text}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => onWordClick(w.id, e)}
                    className={`rounded px-0.5 transition-colors ${
                      isSel
                        ? "bg-red-500/40 text-white"
                        : active
                          ? "text-foreground underline decoration-cyan-400 decoration-2 underline-offset-4"
                          : "text-foreground/75 hover:bg-muted"
                    }`}
                  >
                    {w.text}
                  </button>
                )}{" "}
                {gap >= MIN_GAP && (
                  <button
                    type="button"
                    onClick={() => cutRange(w.end, next.start)}
                    title="Delete this pause"
                    className="text-foreground/40 bg-foreground/8 mr-1 rounded px-1 py-0.5 align-middle font-mono text-[10px] font-bold hover:bg-red-500/20 hover:text-red-400"
                  >
                    […{gap.toFixed(1)}s]
                  </button>
                )}
              </Fragment>
            );
          })}
        </p>
        <p className="text-foreground/40 mt-4 text-xs">
          Click to select &amp; seek · Shift-click for a range · ⌘/Ctrl-click to
          multi-select · Delete to cut · tap a […] pause to remove it
        </p>
      </div>
    </div>
  );
}
