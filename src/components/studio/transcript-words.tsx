"use client";

import { useMemo, useState } from "react";
import { Eraser, Repeat2, Trash2, X } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { isWordCut } from "@/lib/studio/transcript-edit";

export default function TranscriptWords({
  currentSourceTime,
  onSeek,
}: {
  currentSourceTime: number;
  onSeek: (t: number) => void;
}) {
  const { words, clips, deleteWords, removeFillers, removeEarlierTakes } =
    useStudio();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w, i) => m.set(w.id, i));
    return m;
  }, [words]);

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
        <p className="text-sm leading-7">
          {words.map((w) => {
            const cut = isWordCut(clips, w);
            const active =
              !cut &&
              currentSourceTime >= w.start &&
              currentSourceTime <= w.end;
            const isSel = selected.has(w.id);
            if (cut) {
              return (
                <span
                  key={w.id}
                  className="text-foreground/30 px-0.5 line-through"
                >
                  {w.text}{" "}
                </span>
              );
            }
            return (
              <span key={w.id}>
                <button
                  type="button"
                  onClick={(e) => onWordClick(w.id, e)}
                  className={`rounded px-0.5 transition-colors ${
                    isSel
                      ? "text-foreground bg-red-500/30"
                      : active
                        ? "text-foreground bg-cyan-500/30"
                        : "text-foreground/75 hover:bg-muted"
                  }`}
                >
                  {w.text}
                </button>{" "}
              </span>
            );
          })}
        </p>
        <p className="text-foreground/40 mt-4 text-xs">
          Click to select & seek · Shift-click for a range · ⌘/Ctrl-click to
          multi-select · Delete to cut
        </p>
      </div>
    </div>
  );
}
