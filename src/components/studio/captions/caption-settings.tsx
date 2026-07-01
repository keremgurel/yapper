"use client";

import { Check } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { CAPTION_FONTS, type CaptionCase } from "@/lib/studio/captions";
import Segmented from "@/components/studio/captions/segmented";

const SIZE_MIN = 12; // 0.012 of stage height — genuinely small
const SIZE_MAX = 140;

const WORD_OPTIONS = [
  { value: 0, label: "Auto" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
];

const CASE_OPTIONS: { value: CaptionCase; label: string }[] = [
  { value: "none", label: "Original" },
  { value: "lower", label: "lower" },
  { value: "upper", label: "UPPER" },
];

/** All caption styling controls: grouping, font, size, case, apply-to-all. */
export default function CaptionSettings() {
  const {
    captionStyle,
    captionApplyAll,
    captionLines,
    captionWords,
    autoBreakCaptions,
    setCaptionWords,
    setCaptionFont,
    setCaptionScale,
    setCaptionCase,
    toggleCaptionApplyAll,
  } = useStudio();

  const sizeNum = Math.round(captionStyle.fontScale * 1000);
  const setSize = (n: number) =>
    setCaptionScale(
      Math.max(SIZE_MIN, Math.min(SIZE_MAX, n || sizeNum)) / 1000,
    );

  return (
    <div className="space-y-2.5">
      {/* How many words show at a time */}
      <Segmented
        label="Words"
        value={captionWords}
        options={WORD_OPTIONS}
        onChange={setCaptionWords}
      />

      {/* Wrapping within a caption */}
      <Segmented
        label="Lines"
        value={captionLines}
        options={[
          { value: 1, label: "1 line" },
          { value: 2, label: "2 lines" },
        ]}
        onChange={autoBreakCaptions}
      />

      {/* Font family */}
      <Segmented
        label="Font"
        value={captionStyle.fontFamily}
        options={CAPTION_FONTS.map((f) => ({
          value: f.stack,
          label: f.label,
          style: { fontFamily: f.stack },
        }))}
        onChange={setCaptionFont}
      />

      {/* Font size — number + slider (value is 1000× the stage fraction) */}
      <div className="flex items-center gap-3">
        <span className="text-foreground/50 w-12 shrink-0 text-xs font-bold">
          Size
        </span>
        <input
          type="number"
          min={SIZE_MIN}
          max={SIZE_MAX}
          value={sizeNum}
          onChange={(e) => setSize(Number(e.target.value))}
          className="border-border bg-muted text-foreground w-14 rounded-md border px-2 py-1 text-xs tabular-nums"
        />
        <input
          type="range"
          min={SIZE_MIN}
          max={SIZE_MAX}
          value={sizeNum}
          onChange={(e) => setSize(Number(e.target.value))}
          className="flex-1 accent-cyan-500"
        />
      </div>

      {/* Casing — non-destructive, revertible to Original */}
      <Segmented
        label="Case"
        value={captionStyle.textCase}
        options={CASE_OPTIONS}
        onChange={setCaptionCase}
      />

      {/* Apply position/size to all */}
      <button
        type="button"
        onClick={toggleCaptionApplyAll}
        className="text-foreground/70 hover:text-foreground flex items-center gap-2 pt-0.5 text-xs font-bold"
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
    </div>
  );
}
