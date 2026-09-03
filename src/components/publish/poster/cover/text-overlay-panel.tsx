"use client";

import type {
  CoverDraft,
  CoverPosition,
  CoverTextStyle,
} from "@/components/publish/poster/cover-draft";

/** Optional headline burned onto the cover. Off by default. */
export default function TextOverlayPanel({
  draft,
  onChange,
}: {
  draft: CoverDraft;
  onChange: (draft: CoverDraft) => void;
}) {
  const segmented = <T extends string>(
    label: string,
    options: readonly T[],
    value: T,
    pick: (next: T) => void,
  ) => (
    <div
      className="bg-muted flex rounded-lg p-1"
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => pick(option)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize ${
            value === option
              ? "bg-background text-foreground"
              : "text-muted-foreground"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-2">
      <label className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold">Text on the thumbnail</span>
        <button
          type="button"
          role="switch"
          aria-checked={draft.showHeadline}
          onClick={() =>
            onChange({ ...draft, showHeadline: !draft.showHeadline })
          }
          className={`relative h-6 w-11 rounded-full transition-colors ${
            draft.showHeadline ? "bg-[color:var(--sg-accent)]" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-1 left-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
              draft.showHeadline ? "translate-x-5" : "translate-x-0"
            }`}
          />
          <span className="sr-only">Toggle text overlay</span>
        </button>
      </label>
      {draft.showHeadline ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={draft.headline}
            maxLength={100}
            placeholder="Short thumbnail hook"
            onChange={(event) =>
              onChange({ ...draft, headline: event.target.value })
            }
            className="border-border bg-background text-foreground rounded-lg border px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)]"
          />
          {segmented<CoverTextStyle>(
            "Text style",
            ["shadow", "label"],
            draft.textStyle,
            (textStyle) => onChange({ ...draft, textStyle }),
          )}
          {segmented<CoverPosition>(
            "Text position",
            ["top", "center", "bottom"],
            draft.position,
            (position) => onChange({ ...draft, position }),
          )}
        </div>
      ) : null}
    </div>
  );
}
