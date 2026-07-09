"use client";

import { Plus, Merge, Trash2 } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import type { CaptionCase } from "@/lib/studio/types";
import { captionTimelineRange, caseTransform } from "@/lib/studio/captions";

const CASE_GLYPH: Record<CaptionCase, string> = {
  none: "Aa",
  lower: "aa",
  upper: "AA",
};
const CASE_LABEL: Record<CaptionCase, string> = {
  none: "Original",
  lower: "lowercase",
  upper: "UPPERCASE",
};

/** The editable list of caption lines. Click a row to select + seek to it. */
export default function CaptionList({
  onSeek,
  currentSourceTime,
}: {
  onSeek: (timelineTime: number) => void;
  currentSourceTime: number;
}) {
  const {
    clips,
    captions,
    captionStyle,
    selectedCaptionIds,
    selectCaption,
    toggleCaptionSelection,
    setCaptionText,
    cycleCaptionCase,
    addCaption,
    mergeCaptions,
    splitCaptionAtWord,
    removeCaption,
    clearCaptions,
  } = useStudio();

  // Enter splits the caption at the cursor's word boundary.
  const onEnterSplit = (
    e: React.KeyboardEvent<HTMLInputElement>,
    id: string,
  ) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const el = e.currentTarget;
    const pos = el.selectionStart ?? el.value.length;
    const before = el.value.slice(0, pos).trim();
    const after = el.value.slice(pos).trim();
    if (!before || !after) return; // nothing to split off
    splitCaptionAtWord(id, before.split(/\s+/).length);
  };

  const canMerge = selectedCaptionIds.length >= 2;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addCaption(currentSourceTime)}
          className="border-border hover:bg-muted/50 text-foreground flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold"
          title="Add a caption at the playhead"
        >
          <Plus className="h-3.5 w-3.5" />
          Add caption
        </button>
        {canMerge && (
          <button
            type="button"
            onClick={() => mergeCaptions(selectedCaptionIds)}
            className="border-border hover:bg-muted/50 text-foreground flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold"
            title="Merge the selected captions into one"
          >
            <Merge className="h-3.5 w-3.5" />
            Merge {selectedCaptionIds.length}
          </button>
        )}
      </div>

      {captions.length === 0 ? (
        <p className="text-foreground/45 px-1 text-xs">
          No captions yet — generate them from your transcript, or add one.
        </p>
      ) : (
        <div className="flex max-w-[640px] flex-col gap-1.5">
          {captions.map((c, i) => {
            const active = selectedCaptionIds.includes(c.id);
            const effectiveCase = c.textCase ?? captionStyle.textCase;
            return (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                  active
                    ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/15"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCaptionSelection(c.id)}
                  title="Select (⌘/Ctrl-click or use the timeline to multi-select)"
                  className={`w-5 shrink-0 cursor-pointer text-right text-[11px] tabular-nums ${
                    active
                      ? "text-[color:var(--sg-accent)]"
                      : "text-foreground/40 hover:text-foreground/70"
                  }`}
                >
                  {i + 1}
                </button>
                <input
                  value={c.text}
                  onChange={(e) => setCaptionText(c.id, e.target.value)}
                  onKeyDown={(e) => onEnterSplit(e, c.id)}
                  onFocus={() => {
                    selectCaption(c.id);
                    onSeek(captionTimelineRange(clips, c).start + 0.01);
                  }}
                  style={{ textTransform: caseTransform(effectiveCase) }}
                  className="text-foreground min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => cycleCaptionCase(c.id)}
                  title={`Case: ${CASE_LABEL[effectiveCase]} (click to change just this caption)`}
                  className="text-foreground/45 hover:text-foreground w-6 shrink-0 text-center text-[11px] font-bold"
                >
                  {CASE_GLYPH[effectiveCase]}
                </button>
                <button
                  type="button"
                  onClick={() => removeCaption(c.id)}
                  className="text-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-400"
                  aria-label="Delete caption"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {captions.length > 0 && (
        <button
          type="button"
          onClick={clearCaptions}
          className="text-foreground/40 hover:text-foreground text-xs font-bold"
        >
          Clear all captions
        </button>
      )}
    </div>
  );
}
