"use client";

import { RotateCcw, WandSparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DEFAULT_CAPTION_BRIEF } from "@/lib/publish/caption-prompt";

/** The reusable AI brief stays visible and editable. It is not hidden inside
 * settings because changing the angle is part of preparing this particular
 * post, not an account preference. */
export default function GenerationBrief({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const customized = value !== DEFAULT_CAPTION_BRIEF;

  return (
    <section className="border-border overflow-hidden rounded-xl border bg-[color:var(--sg-surface-raised)]">
      <div className="border-border/60 flex items-center gap-2 border-b px-4 py-3">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[color:color-mix(in_srgb,var(--sg-accent)_16%,transparent)] text-[color:var(--sg-accent)]">
          <WandSparkles aria-hidden className="h-4 w-4" />
        </span>
        <div>
          <p className="text-foreground text-sm font-semibold">Writing brief</p>
          <p className="text-muted-foreground text-[11px]">
            The default is ready. Add the angle, offer, tone, or CTA you want.
          </p>
        </div>
        {customized ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(DEFAULT_CAPTION_BRIEF)}
            className="ml-auto"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            Reset
          </Button>
        ) : null}
      </div>
      <label className="block p-4">
        <span className="sr-only">Instructions for caption generation</span>
        <textarea
          value={value}
          disabled={disabled}
          maxLength={2000}
          rows={5}
          onChange={(event) => onChange(event.target.value)}
          className="border-border bg-background text-foreground placeholder:text-muted-foreground min-h-32 w-full resize-y rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none disabled:opacity-60"
          placeholder="Add context: the audience, the offer, the point to emphasize, words to avoid…"
        />
        <span className="text-muted-foreground mt-1.5 block text-right font-mono text-[10px] tabular-nums">
          {value.length}/2000
        </span>
      </label>
    </section>
  );
}
