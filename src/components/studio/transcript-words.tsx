"use client";

import { Fragment, useMemo, useState } from "react";
import { Scissors, Sparkles, Trash2, X } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { isRangeCut, isWordCut } from "@/lib/studio/transcript-edit";

const MIN_GAP = 0.4; // seconds; shorter pauses aren't shown as chips

export default function TranscriptWords({
  currentSourceTime,
  onSeek,
  showDeleted,
}: {
  currentSourceTime: number;
  onSeek: (t: number) => void;
  showDeleted: boolean;
}) {
  const {
    words,
    clips,
    deleteWords,
    cutRange,
    removePauses,
    aiRemoveMistakes,
    aiCleaning,
  } = useStudio();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState("");

  const onAiClean = async () => {
    setAiMsg("");
    const n = await aiRemoveMistakes();
    if (n === -1) setAiMsg("Add SURPLUS_API_KEY to enable the AI pass.");
    else if (n === -2) setAiMsg("AI cleanup failed — try again.");
    else if (n === 0) setAiMsg("No mistakes found.");
    else setAiMsg(`Marked ${n} section${n === 1 ? "" : "s"} to cut.`);
  };

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w, i) => m.set(w.id, i));
    return m;
  }, [words]);

  // The single active word under the playhead (latest match wins, so
  // overlapping word timings don't light up two words at once).
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
          onClick={() => void onAiClean()}
          disabled={aiCleaning}
          className="bg-foreground text-background inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {aiCleaning ? "Cleaning…" : "Clean up retakes"}
        </button>
        <button
          type="button"
          onClick={() => removePauses()}
          className={toolBtn}
        >
          <Scissors className="h-3.5 w-3.5" />
          Remove pauses
        </button>
      </div>

      {/* Words + floating action overlays (absolute, so no layout shift). */}
      <div className="relative min-h-0 flex-1">
        <div className="h-full overflow-y-auto p-4">
          <p className="text-sm leading-8">
            {words.map((w, i) => {
              const cut = isWordCut(clips, w);
              const active = !cut && w.id === activeId;
              const isSel = selected.has(w.id);
              const next = words[i + 1];
              const gap =
                !cut && next && !isWordCut(clips, next)
                  ? next.start - w.end
                  : 0;
              const showGap =
                gap >= MIN_GAP && !isRangeCut(clips, w.end, next.start);
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
                  {showGap && (
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
            Click to select &amp; seek · Shift-click for a range · ⌘/Ctrl-click
            to multi-select · tap a […] pause to remove it
          </p>
        </div>

        {selected.size > 0 && (
          <div className="border-border bg-card/95 absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 shadow-xl backdrop-blur">
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
              className="text-foreground/60 hover:text-foreground hover:bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        )}

        {aiMsg && selected.size === 0 && (
          <button
            type="button"
            onClick={() => setAiMsg("")}
            className="border-border bg-card/95 text-foreground/70 absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-xl backdrop-blur"
          >
            {aiMsg}
          </button>
        )}
      </div>
    </div>
  );
}
