"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COVER_PRESETS,
  type CoverDraft,
  type CoverPosition,
  type CoverPreset,
} from "@/components/publish/poster/cover-draft";

const POSITION_CLASS: Record<CoverPosition, string> = {
  top: "justify-start pt-[12%]",
  center: "justify-center",
  bottom: "justify-end pb-[12%]",
};

/** The cover proof and its three controls: text, look, placement. What is on
 * screen is what `renderCover` writes to the PNG. */
export default function CoverCanvas({
  draft,
  onChange,
  onDownload,
}: {
  draft: CoverDraft;
  onChange: (draft: CoverDraft) => void;
  onDownload: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(150px,0.7fr)_1fr]">
      <div
        className={`relative mx-auto flex aspect-[9/16] w-full max-w-[200px] overflow-hidden rounded-xl p-[8%] ${COVER_PRESETS[draft.preset].shell} ${POSITION_CLASS[draft.position]}`}
      >
        <div
          className={`h-fit w-full rounded-lg px-3 py-3 text-center text-base leading-tight font-bold ${COVER_PRESETS[draft.preset].card}`}
        >
          {draft.headline || "Your text hook"}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="text-muted-foreground mb-1.5 block text-xs font-semibold">
            Cover text
          </span>
          <textarea
            value={draft.headline}
            rows={3}
            onChange={(event) =>
              onChange({ ...draft, headline: event.target.value })
            }
            className="bg-muted text-foreground w-full resize-none rounded-lg px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
          />
        </label>

        <div
          className="bg-muted flex rounded-lg p-1"
          role="group"
          aria-label="Cover look"
        >
          {(Object.keys(COVER_PRESETS) as CoverPreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              aria-pressed={draft.preset === preset}
              onClick={() => onChange({ ...draft, preset })}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                draft.preset === preset
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {COVER_PRESETS[preset].label}
            </button>
          ))}
        </div>

        <div
          className="bg-muted flex rounded-lg p-1"
          role="group"
          aria-label="Cover text position"
        >
          {(["top", "center", "bottom"] as CoverPosition[]).map((position) => (
            <button
              key={position}
              type="button"
              aria-pressed={draft.position === position}
              onClick={() => onChange({ ...draft, position })}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold capitalize transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                draft.position === position
                  ? "bg-background text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {position}
            </button>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={onDownload}>
          <Download aria-hidden />
          Download 1080 x 1920 PNG
        </Button>
      </div>
    </div>
  );
}
