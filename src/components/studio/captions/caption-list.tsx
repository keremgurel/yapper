"use client";

import { Trash2 } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { captionTimelineRange } from "@/lib/studio/captions";

/** The editable list of caption lines. Click a row to select + seek to it. */
export default function CaptionList({
  onSeek,
}: {
  onSeek: (timelineTime: number) => void;
}) {
  const {
    clips,
    captions,
    selectedCaptionId,
    selectCaption,
    setCaptionText,
    removeCaption,
    clearCaptions,
  } = useStudio();

  if (captions.length === 0) {
    return (
      <p className="text-foreground/45 px-1 text-xs">
        No captions yet — generate them from your transcript.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
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
                active ? "text-cyan-300" : "text-foreground/40"
              }`}
            >
              {i + 1}
            </span>
            <input
              value={c.text}
              onChange={(e) => setCaptionText(c.id, e.target.value)}
              onFocus={() => {
                selectCaption(c.id);
                onSeek(captionTimelineRange(clips, c).start + 0.01);
              }}
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
      <button
        type="button"
        onClick={clearCaptions}
        className="text-foreground/40 hover:text-foreground mt-2 text-xs font-bold"
      >
        Clear all captions
      </button>
    </div>
  );
}
