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
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 8, label: "8" },
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
    captionWords,
    selectedCaptionIds,
    setCaptionWords,
    setCaptionFont,
    setCaptionScale,
    setCaptionCase,
    toggleCaptionApplyAll,
  } = useStudio();

  const targetingSelection = !captionApplyAll;
  const noSelection = targetingSelection && selectedCaptionIds.length === 0;

  const sizeNum = Math.round(captionStyle.fontScale * 1000);
  const setSize = (n: number) =>
    setCaptionScale(
      Math.max(SIZE_MIN, Math.min(SIZE_MAX, n || sizeNum)) / 1000,
    );

  return (
    <div className="max-w-[440px] space-y-2.5">
      {/* How many words show at a time */}
      <Segmented
        label="Words"
        value={captionWords}
        options={WORD_OPTIONS}
        onChange={setCaptionWords}
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
          className="flex-1 accent-[color:var(--sg-accent)]"
        />
      </div>

      {/* Casing — non-destructive, revertible to Original */}
      <Segmented
        label="Case"
        value={captionStyle.textCase}
        options={CASE_OPTIONS}
        onChange={setCaptionCase}
      />

      {/* Whether font / size / case / move / resize apply to every caption or
          just the selected one(s). */}
      <button
        type="button"
        onClick={toggleCaptionApplyAll}
        className="text-foreground/70 hover:text-foreground flex items-center gap-2 pt-0.5 text-xs font-bold"
      >
        <span
          className={`flex h-4 w-4 items-center justify-center rounded border ${
            captionApplyAll
              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
              : "border-border"
          }`}
        >
          {captionApplyAll && <Check className="h-3 w-3" />}
        </span>
        Apply changes to all captions
      </button>
      {targetingSelection && (
        <p className="text-foreground/45 text-[11px]">
          {noSelection
            ? "Select caption(s) in the list or on the video to restyle just those."
            : `Changes apply to ${selectedCaptionIds.length} selected caption${
                selectedCaptionIds.length === 1 ? "" : "s"
              }.`}
        </p>
      )}
    </div>
  );
}
