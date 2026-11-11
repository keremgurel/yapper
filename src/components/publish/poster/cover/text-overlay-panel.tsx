"use client";

import { Button } from "@/components/ui/button";
import {
  coverFonts,
  defaultCoverText,
  type CoverDraft,
  type CoverTextAppearance,
  type CoverPosition,
} from "../cover-draft";
import { posterField } from "../poster-layout";

export default function TextOverlayPanel({
  draft,
  onChange,
}: {
  draft: CoverDraft;
  onChange: (value: CoverDraft) => void;
}) {
  const { text } = draft;
  const set = (patch: Partial<CoverTextAppearance>) =>
    onChange({ ...draft, text: { ...text, ...patch } });
  const groups = [
    {
      label: "Background",
      enabled: "background",
      color: "backgroundColor",
      radius: "cornerRadius",
      range: "Corner radius",
    },
    {
      label: "Shadow",
      enabled: "shadow",
      color: "shadowColor",
      radius: "shadowRadius",
      range: "Shadow blur",
    },
    { label: "Outline", enabled: "stroke", color: "strokeColor" },
  ] as const;
  return (
    <div className="space-y-4">
      <label className="block space-y-2 text-sm font-medium">
        <span>Cover text</span>
        <textarea
          value={draft.headline}
          maxLength={100}
          rows={2}
          placeholder="Write a short hook…"
          className={posterField}
          onChange={(event) =>
            onChange({
              ...draft,
              headline: event.target.value,
              showHeadline: Boolean(event.target.value.trim()),
            })
          }
        />
      </label>
      <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-sm font-medium">Font</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(coverFonts) as (keyof typeof coverFonts)[]).map(
            (font) => (
              <Button
                key={font}
                size="sm"
                type="button"
                variant={text.font === font ? "secondary" : "outline"}
                aria-pressed={text.font === font}
                style={{ fontFamily: coverFonts[font].family }}
                onClick={() => set({ font })}
              >
                {coverFonts[font].label}
              </Button>
            ),
          )}
        </div>
      </fieldset>
      <label className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
        Size
        <input
          type="range"
          min={48}
          max={160}
          step={2}
          value={text.size}
          className="accent-primary min-w-0"
          onChange={(event) => set({ size: Number(event.target.value) })}
        />
        <span className="tabular-nums">{text.size}</span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Text position"
          className="flex flex-wrap gap-2"
        >
          {(["top", "center", "bottom"] as CoverPosition[]).map((position) => (
            <Button
              key={position}
              type="button"
              variant={draft.position === position ? "secondary" : "outline"}
              size="sm"
              aria-pressed={draft.position === position}
              onClick={() => onChange({ ...draft, position })}
              className="capitalize"
            >
              {position}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Fill
          <input
            type="color"
            value={text.fill}
            className="border-border size-8 rounded border"
            onChange={(event) => set({ fill: event.target.value })}
          />
        </label>
      </div>
      {groups.map((group) => (
        <div
          key={group.enabled}
          className="border-border space-y-2 border-t pt-3"
        >
          <div className="flex items-center justify-between gap-2">
            <label className="flex min-h-8 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="accent-primary"
                checked={text[group.enabled]}
                onChange={(event) =>
                  set({ [group.enabled]: event.target.checked })
                }
              />
              {group.label}
            </label>
            {text[group.enabled] && (
              <input
                type="color"
                aria-label={group.label + " color"}
                value={text[group.color]}
                className="border-border size-8 rounded border"
                onChange={(event) => set({ [group.color]: event.target.value })}
              />
            )}
          </div>
          {text[group.enabled] && "radius" in group && (
            <label className="grid grid-cols-[auto_1fr_auto] items-center gap-3 text-sm">
              {group.range}
              <input
                type="range"
                min={0}
                max={64}
                value={text[group.radius]}
                className="accent-primary min-w-0"
                onChange={(event) =>
                  set({ [group.radius]: Number(event.target.value) })
                }
              />
              <span className="tabular-nums">{text[group.radius]}</span>
            </label>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange({
            ...draft,
            text: { ...defaultCoverText },
            position: "bottom",
          })
        }
      >
        Reset text style
      </Button>
    </div>
  );
}
