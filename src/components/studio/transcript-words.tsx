"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  RotateCcw,
  Scissors,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStudio } from "@/components/studio/studio-context";
import { activeWordId } from "@/lib/studio/active-word";
import { isRangeCut, isWordCut } from "@/lib/studio/transcript-edit";
import type { Word } from "@/lib/studio/types";

const MIN_GAP = 0.4; // seconds; shorter pauses aren't shown as chips

export default function TranscriptWords({
  currentTimelineTime,
  onSeek,
  showDeleted,
}: {
  currentTimelineTime: number;
  onSeek: (t: number) => void;
  showDeleted: boolean;
}) {
  const {
    source,
    words,
    clips,
    deleteWords,
    restoreWords,
    cutRange,
    restoreRange,
    removePauses,
    aiRemoveMistakes,
    aiCleaning,
    autoEdit,
    autoEditing,
    transcribe,
    transcribeStatus,
  } = useStudio();
  const transcribing = transcribeStatus === "transcribing";
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  const [aiMsg, setAiMsg] = useState("");

  const selectedWords = [...selected]
    .map((id) => words.find((w) => w.id === id))
    .filter((w): w is Word => !!w);
  const selLive = selectedWords.filter((w) => !isWordCut(clips, w));
  const selCut = selectedWords.filter((w) => isWordCut(clips, w));

  const onAiClean = async () => {
    setAiMsg("");
    const n = await aiRemoveMistakes();
    if (n === 0) setAiMsg("No retakes found.");
    else setAiMsg(`Marked ${n} section${n === 1 ? "" : "s"} to cut.`);
  };

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    words.forEach((w, i) => m.set(w.id, i));
    return m;
  }, [words]);

  // The single active word under the playhead. The playhead is a timeline
  // position; activeWordId maps it to recording source (so it stays right over
  // a b-roll) and picks the covering word, latest match winning.
  const activeId = useMemo(
    () => activeWordId(words, clips, currentTimelineTime),
    [words, clips, currentTimelineTime],
  );
  const firstWord = words[0];
  const lastWord = words[words.length - 1];
  const headGap =
    firstWord && !isWordCut(clips, firstWord) ? firstWord.start : 0;
  const tailGap =
    source && lastWord && !isWordCut(clips, lastWord)
      ? Math.max(0, source.duration - lastWord.end)
      : 0;
  const headGapIsCut =
    headGap >= MIN_GAP && isRangeCut(clips, 0, firstWord.start);
  const tailGapIsCut =
    tailGap >= MIN_GAP &&
    source != null &&
    isRangeCut(clips, lastWord.end, source.duration);

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
      if (word && !isWordCut(clips, word)) onSeek(word.start);
    }
  };

  const applyDelete = () => {
    deleteWords(selLive.map((w) => w.id));
    clearSelection();
  };

  const applyRestore = () => {
    restoreWords(selCut.map((w) => w.id));
    clearSelection();
  };

  const toolBtn =
    "border-border text-foreground/80 hover:bg-muted hover:text-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors";

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <Button
          type="button"
          size="sm"
          onClick={() => void autoEdit(true)}
          disabled={autoEditing}
          className="text-xs font-bold"
          title="Trim silence, remove mistakes, cut pauses, and add captions — in one click"
        >
          {autoEditing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          {autoEditing ? "Editing…" : "1-Click Edit + Captions"}
        </Button>
        <button
          type="button"
          onClick={() => void autoEdit(false)}
          disabled={autoEditing}
          className={toolBtn}
          title="Trim silence, remove mistakes, and cut pauses — without captions"
        >
          <Wand2 className="h-3.5 w-3.5" />
          1-Click Edit
        </button>
        <button
          type="button"
          onClick={() => void transcribe()}
          disabled={transcribing}
          className={toolBtn}
          title="Re-run transcription from the audio"
        >
          {transcribing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {transcribing ? "Transcribing…" : "Transcribe again"}
        </button>
        <button
          type="button"
          onClick={() => void onAiClean()}
          disabled={aiCleaning}
          className={toolBtn}
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
            {headGap >= MIN_GAP && (!headGapIsCut || showDeleted) && (
              <button
                type="button"
                onClick={() =>
                  headGapIsCut
                    ? restoreRange(0, firstWord.start)
                    : cutRange(0, firstWord.start)
                }
                title={
                  headGapIsCut
                    ? "Restore this removed opening silence"
                    : "Delete this opening silence"
                }
                className={
                  headGapIsCut
                    ? "text-foreground/25 mr-1 rounded px-1 py-0.5 align-middle font-mono text-[10px] font-bold line-through transition-colors hover:bg-emerald-500/15 hover:text-emerald-400"
                    : "text-foreground/40 bg-foreground/8 mr-1 rounded px-1 py-0.5 align-middle font-mono text-[10px] font-bold hover:bg-red-500/20 hover:text-red-400"
                }
              >
                […{headGap.toFixed(1)}s{headGapIsCut ? " removed" : ""}]
              </button>
            )}
            {words.map((w, i) => {
              const cut = isWordCut(clips, w);
              const active = !cut && w.id === activeId;
              const isSel = selected.has(w.id);
              const next = words[i + 1];
              const gap =
                !cut && next && !isWordCut(clips, next)
                  ? next.start - w.end
                  : 0;
              const gapIsCut =
                gap >= MIN_GAP && isRangeCut(clips, w.end, next.start);
              const showGap = gap >= MIN_GAP && !gapIsCut;
              const showDeletedGap = showDeleted && gapIsCut;
              if (cut && !showDeleted) return null;
              return (
                <Fragment key={w.id}>
                  {cut ? (
                    <button
                      type="button"
                      onClick={(e) => onWordClick(w.id, e)}
                      className={`rounded px-0.5 line-through transition-colors ${
                        isSel
                          ? "bg-emerald-500/50 text-white"
                          : "text-foreground/30 hover:bg-muted"
                      }`}
                    >
                      {w.text}
                    </button>
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
                  {showDeletedGap && (
                    <button
                      type="button"
                      onClick={() => restoreRange(w.end, next.start)}
                      title="Restore this removed pause"
                      className="text-foreground/25 mr-1 rounded px-1 py-0.5 align-middle font-mono text-[10px] font-bold line-through transition-colors hover:bg-emerald-500/15 hover:text-emerald-400"
                    >
                      […{gap.toFixed(1)}s removed]
                    </button>
                  )}
                </Fragment>
              );
            })}
            {tailGap >= MIN_GAP && (!tailGapIsCut || showDeleted) && (
              <button
                type="button"
                onClick={() => {
                  if (!source || !lastWord) return;
                  if (tailGapIsCut) restoreRange(lastWord.end, source.duration);
                  else cutRange(lastWord.end, source.duration);
                }}
                title={
                  tailGapIsCut
                    ? "Restore this removed ending silence"
                    : "Delete this ending silence"
                }
                className={
                  tailGapIsCut
                    ? "text-foreground/25 mr-1 rounded px-1 py-0.5 align-middle font-mono text-[10px] font-bold line-through transition-colors hover:bg-emerald-500/15 hover:text-emerald-400"
                    : "text-foreground/40 bg-foreground/8 mr-1 rounded px-1 py-0.5 align-middle font-mono text-[10px] font-bold hover:bg-red-500/20 hover:text-red-400"
                }
              >
                […{tailGap.toFixed(1)}s{tailGapIsCut ? " removed" : ""}]
              </button>
            )}
          </p>
          <p className="text-foreground/40 mt-4 text-xs">
            Click to select &amp; seek · Shift-click a range · ⌘/Ctrl-click to
            multi-select · select struck-through words to restore them · tap a
            […] pause to remove it · show deleted to restore removed pauses
          </p>
        </div>

        {selected.size > 0 && (
          <div className="border-border bg-card/95 absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border p-1 shadow-xl backdrop-blur">
            {selCut.length > 0 && (
              <button
                type="button"
                onClick={applyRestore}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-black text-white transition-opacity hover:opacity-90"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore {selCut.length}
              </button>
            )}
            {selLive.length > 0 && (
              <button
                type="button"
                onClick={applyDelete}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-xs font-black text-white transition-opacity hover:opacity-90"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete {selLive.length}
              </button>
            )}
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
