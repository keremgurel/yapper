"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";
import HookGenerateMenu from "@/components/workbench/hook-generate-menu";
import { Button } from "@/components/ui/button";
import { chooseHook } from "@/lib/content/hook-choice";
import { hookPatternName } from "@/lib/content/hook-patterns";
import type { GenErrorKind } from "@/hooks/use-idea-generation";
import type { ContentHook } from "@/lib/db/schema";

/**
 * The hook shortlist, with the one you are going with at the top.
 *
 * Picking a hook moves it to position 0 rather than setting a flag, because
 * everything downstream already treats the first hook as the real one (see
 * `hook-choice.ts`). The rejected options stay: they are what you compare
 * against when the chosen line stops feeling right.
 *
 * Editing a hook's text drops its `pattern` and `why`. Those describe the line
 * the model wrote, and keeping them on a line the creator rewrote would credit
 * a mechanism the new text may not use.
 */
export default function HookList({
  hooks,
  onChange,
  generating,
  canGenerate,
  genError,
  onGenerate,
}: {
  hooks: ContentHook[];
  onChange: (hooks: ContentHook[]) => void;
  generating: boolean;
  canGenerate: boolean;
  genError: GenErrorKind | null;
  onGenerate: (patternId: string | null) => void;
}) {
  const setText = (index: number, text: string) =>
    onChange(
      hooks.map((hook, i) =>
        i === index ? { text, pattern: null, why: null } : hook,
      ),
    );

  return (
    <section aria-labelledby="wb-hooks">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2
          id="wb-hooks"
          className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase"
        >
          Hook
        </h2>
        {hooks.length > 1 && (
          <span className="text-muted-foreground text-xs">
            {hooks.length} options · top one is the take
          </span>
        )}
      </div>

      {hooks.length === 0 ? (
        <p className="text-muted-foreground border-border rounded-lg border border-dashed px-3 py-4 text-sm">
          No hooks yet. Generate a few and pick the one that stops the scroll.
        </p>
      ) : (
        <div className="space-y-1.5">
          {hooks.map((hook, i) => {
            const chosen = i === 0;
            return (
              <div
                key={i}
                className={`group flex items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                  chosen
                    ? "border-[color:var(--sg-accent)]/50 bg-[color:var(--sg-accent)]/5"
                    : "border-border hover:border-foreground/25"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange(chooseHook(hooks, i))}
                  aria-label={
                    chosen
                      ? "This is the hook you are using"
                      : `Use hook ${i + 1}`
                  }
                  aria-pressed={chosen}
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    chosen
                      ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
                      : "border-border group-hover:border-foreground/40"
                  }`}
                >
                  {chosen && <Check className="h-2.5 w-2.5" />}
                </button>

                <div className="min-w-0 flex-1">
                  <textarea
                    value={hook.text}
                    onChange={(e) => setText(i, e.target.value)}
                    rows={1}
                    placeholder="An opening line that stops the scroll"
                    aria-label={`Hook ${i + 1}`}
                    className={`text-foreground placeholder:text-muted-foreground/60 w-full resize-none bg-transparent text-sm outline-none ${
                      chosen ? "font-semibold" : ""
                    }`}
                  />
                  {hook.pattern && (
                    <span
                      // The reasoning is a title rather than always-on text: it
                      // helps when choosing between hooks, and is noise while
                      // writing one.
                      title={hook.why ?? undefined}
                      className="text-muted-foreground mt-0.5 inline-block text-[11px] font-bold"
                    >
                      {hookPatternName(hook.pattern)}
                    </span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(hooks.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove hook ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <HookGenerateMenu
        running={generating}
        disabled={generating || !canGenerate}
        onGenerate={onGenerate}
      />

      {genError === "locked" && (
        <Button asChild variant="link" className="mt-1 h-auto p-0">
          <Link href="/pricing">Subscribe to unlock AI generation</Link>
        </Button>
      )}
      {genError === "insufficient" && (
        <p className="mt-1 text-sm font-semibold text-amber-500">
          Out of credits. Top up to keep generating.
        </p>
      )}
      {genError === "failed" && (
        <p className="text-destructive mt-1 text-sm font-semibold">
          Hook generation failed. No credit charged. Try again.
        </p>
      )}
    </section>
  );
}
