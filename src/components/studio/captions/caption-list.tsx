"use client";

import { Trash2 } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { captionTimelineRange, caseTransform } from "@/lib/studio/captions";

/** The editable list of caption lines. Click a row to select + seek to it. */
export default function CaptionList({
  onSeek,
}: {
  onSeek: (timelineTime: number) => void;
}) {
  const {
    clips,
    captions,
    captionStyle,
    selectedCaptionId,
    selectCaption,
    setCaptionText,
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

  if (captions.length === 0) {
    return (
      <p className="text-foreground/45 px-1 text-xs">
        No captions yet — generate them from your transcript.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mx-auto flex max-w-[640px] flex-col gap-1.5">
        {captions.map((c, i) => {
          const active = selectedCaptionId === c.id;
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-colors ${
                active
                  ? "border-cyan-400 bg-cyan-500/20"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              <span
                className={`w-5 shrink-0 text-right text-[11px] tabular-nums ${
                  active
                    ? "text-cyan-600 dark:text-cyan-300"
                    : "text-foreground/40"
                }`}
              >
                {i + 1}
              </span>
              <input
                value={c.text}
                onChange={(e) => setCaptionText(c.id, e.target.value)}
                onKeyDown={(e) => onEnterSplit(e, c.id)}
                onFocus={() => {
                  selectCaption(c.id);
                  onSeek(captionTimelineRange(clips, c).start + 0.01);
                }}
                style={{ textTransform: caseTransform(captionStyle.textCase) }}
                className="text-foreground min-w-0 flex-1 bg-transparent text-[13px] outline-none"
              />
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
      <button
        type="button"
        onClick={clearCaptions}
        className="text-foreground/40 hover:text-foreground text-xs font-bold"
      >
        Clear all captions
      </button>
    </div>
  );
}
