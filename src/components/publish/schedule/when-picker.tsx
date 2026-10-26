"use client";

import { useId, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { localScheduleInput } from "@/lib/publish/schedule-client";
import { quickTimes } from "./quick-times";

export type WhenMode = "now" | "later";

const MODES: { key: WhenMode; label: string }[] = [
  { key: "now", label: "Post now" },
  { key: "later", label: "Schedule" },
];

/**
 * Now or later, and when. The time is the creator's local wall clock; the
 * zone is named under the field so a creator who travels sees which clock it
 * follows.
 */
export default function WhenPicker({
  mode,
  onMode,
  value,
  onValue,
  disabled,
  note,
}: {
  mode: WhenMode;
  onMode: (mode: WhenMode) => void;
  /** A `datetime-local` value: `YYYY-MM-DDTHH:mm` in local time. */
  value: string;
  onValue: (value: string) => void;
  disabled: boolean;
  note?: string;
}) {
  const id = useId();
  const options = useMemo(() => quickTimes(new Date()), []);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="sr-only">When to post</legend>
      <div
        role="radiogroup"
        aria-label="When to post"
        className="bg-muted grid grid-cols-2 rounded-lg p-0.5"
      >
        {MODES.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={mode === option.key}
            onClick={() => onMode(option.key)}
            className={`focus-visible:ring-ring min-h-9 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              mode === option.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {mode === "later" && (
        <div className="space-y-2">
          <label htmlFor={`${id}-at`} className="sr-only">
            Date and time
          </label>
          <input
            id={`${id}-at`}
            type="datetime-local"
            value={value}
            min={localScheduleInput(new Date())}
            onChange={(event) => onValue(event.target.value)}
            className="border-border bg-card min-h-11 w-full rounded-lg border px-3 py-2 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <div className="flex flex-wrap gap-2">
            {options.map((option) => {
              const local = localScheduleInput(option.at);
              return (
                <Button
                  key={option.label}
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-pressed={value === local}
                  className="aria-pressed:border-foreground/40 aria-pressed:bg-muted"
                  onClick={() => onValue(local)}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
          <p className="text-muted-foreground text-xs">
            Your time zone: {timezone}.{note ? ` ${note}` : ""}
          </p>
        </div>
      )}
    </fieldset>
  );
}
