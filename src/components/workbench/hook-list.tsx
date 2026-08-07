"use client";

import Link from "next/link";
import { Plus, X } from "lucide-react";
import HookGenerateMenu from "@/components/workbench/hook-generate-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hookPatternName } from "@/lib/content/hook-patterns";
import type { GenErrorKind } from "@/hooks/use-idea-generation";
import type { ContentHook } from "@/lib/db/schema";

/**
 * The hook variations, each with the archetype it was written against.
 *
 * Editing a hook's text drops its `pattern` and `why`: those describe the line
 * the model produced, and keeping them attached to a line the creator rewrote
 * would credit a mechanism the new text may not use.
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
      <h2
        id="wb-hooks"
        className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase"
      >
        Hook variations
      </h2>

      <div className="space-y-2">
        {hooks.map((hook, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <Input
                value={hook.text}
                onChange={(e) => setText(i, e.target.value)}
                placeholder="An opening line that stops the scroll"
                aria-label={`Hook ${i + 1}`}
              />
              {hook.pattern && (
                <span
                  // The reasoning is a title rather than always-on text: it is
                  // useful when choosing between hooks, noise while writing one.
                  title={hook.why ?? undefined}
                  className="mt-1 inline-block rounded-full bg-[color:var(--sg-accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[color:var(--sg-accent)]"
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
              className="text-muted-foreground hover:text-destructive mt-1"
              aria-label={`Remove hook ${i + 1}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange([...hooks, { text: "", pattern: null, why: null }])
        }
        className="text-muted-foreground mt-2 -ml-2"
      >
        <Plus className="h-4 w-4" /> Add hook
      </Button>

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
