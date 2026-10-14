"use client";

import { CHIP_TONES, formatTone } from "@/components/studio-ui";
import {
  CONTENT_FORMATS,
  VERSION_FORMATS,
  type VersionFormat,
} from "@/lib/content/formats";

type Choice = VersionFormat | null;

/** The three formats an idea can be written in, as a small segmented control
 * with each format's colour. With `allLabel`, a first option stands for every
 * format and reads as `null`. The native app's `NativeSegmented.formats`. */
export default function FormatPicker<T extends Choice>({
  value,
  onChange,
  labelledBy,
  allLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  labelledBy: string;
  allLabel?: string;
}) {
  const options: { value: Choice; label: string }[] = [
    ...(allLabel ? [{ value: null, label: allLabel }] : []),
    ...VERSION_FORMATS.map((format) => ({
      value: format,
      label: CONTENT_FORMATS.find((entry) => entry.id === format)?.label ?? "",
    })),
  ];
  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="bg-muted border-border inline-flex rounded-lg border p-0.5"
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value ?? "all"}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value as T)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              on
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.value ? (
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${CHIP_TONES[formatTone(option.value)].dot}`}
              />
            ) : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
