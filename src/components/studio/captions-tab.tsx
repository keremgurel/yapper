"use client";

import { Check, Sparkles, Trash2, Type } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { CAPTION_FONTS, captionTimelineRange } from "@/lib/studio/captions";

export default function CaptionsTab({
  onSeek,
}: {
  onSeek: (timelineTime: number) => void;
}) {
  const {
    words,
    clips,
    captions,
    captionStyle,
    captionApplyAll,
    captionLines,
    selectedCaptionId,
    generateCaptionsFromTranscript,
    autoBreakCaptions,
    selectCaption,
    setCaptionText,
    removeCaption,
    clearCaptions,
    setCaptionFont,
    setCaptionScale,
    toggleCaptionApplyAll,
  } = useStudio();

  if (words.length === 0) {
    return (
      <div className="flex h-full flex-col items-start gap-3 p-4">
        <p className="text-foreground/60 text-sm leading-6">
          Transcribe the video first (Transcript tab), then generate captions
          from the words.
        </p>
      </div>
    );
  }

  const seg =
    "border-border text-foreground/70 hover:bg-muted rounded-full border px-3 py-1.5 text-xs font-bold";
  const segActive = "bg-foreground text-background border-foreground";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border shrink-0 space-y-3 border-b p-4">
        <button
          type="button"
          onClick={generateCaptionsFromTranscript}
          className="bg-foreground text-background flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
        >
          <Sparkles className="h-4 w-4" />
          {captions.length > 0 ? "Regenerate captions" : "Generate captions"}
        </button>

        {captions.length > 0 && (
          <>
            {/* Break into 1 or 2 lines */}
            <div className="flex items-center gap-2">
              <span className="text-foreground/50 text-xs font-bold">
                Max lines
              </span>
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => autoBreakCaptions(n)}
                  className={`${seg} ${captionLines === n ? segActive : ""}`}
                >
                  {n} line{n > 1 ? "s" : ""}
                </button>
              ))}
            </div>

            {/* Font family */}
            <div className="flex items-center gap-2">
              <Type className="text-foreground/50 h-3.5 w-3.5 shrink-0" />
              {CAPTION_FONTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCaptionFont(f.stack)}
                  style={{ fontFamily: f.stack }}
                  className={`${seg} ${captionStyle.fontFamily === f.stack ? segActive : ""}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Font size */}
            <div className="flex items-center gap-2">
              <span className="text-foreground/50 text-xs font-bold">Size</span>
              <input
                type="range"
                min={0.03}
                max={0.12}
                step={0.005}
                value={captionStyle.fontScale}
                onChange={(e) => setCaptionScale(Number(e.target.value))}
                className="flex-1 accent-cyan-500"
              />
            </div>

            {/* Apply position/size to all */}
            <button
              type="button"
              onClick={toggleCaptionApplyAll}
              className="text-foreground/70 hover:text-foreground flex items-center gap-2 text-xs font-bold"
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded border ${
                  captionApplyAll
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-border"
                }`}
              >
                {captionApplyAll && <Check className="h-3 w-3" />}
              </span>
              Move/resize applies to all captions
            </button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {captions.length === 0 ? (
          <p className="text-foreground/45 px-1 text-xs">
            No captions yet — generate them from your transcript.
          </p>
        ) : (
          <div className="space-y-1.5">
            {captions.map((c, i) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 ${
                  selectedCaptionId === c.id
                    ? "border-cyan-500/60 bg-cyan-500/10"
                    : "border-border"
                }`}
              >
                <span className="text-foreground/40 w-5 shrink-0 text-right text-[11px]">
                  {i + 1}
                </span>
                <input
                  value={c.text}
                  onChange={(e) => setCaptionText(c.id, e.target.value)}
                  onFocus={() => {
                    selectCaption(c.id);
                    onSeek(captionTimelineRange(clips, c).start + 0.01);
                  }}
                  className="text-foreground/90 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
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
            ))}
            <button
              type="button"
              onClick={clearCaptions}
              className="text-foreground/40 hover:text-foreground mt-2 text-xs font-bold"
            >
              Clear all captions
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
