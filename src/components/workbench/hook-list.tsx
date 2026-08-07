"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
}: {
  hooks: ContentHook[];
  onChange: (hooks: ContentHook[]) => void;
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
                  {hook.pattern}
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
    </section>
  );
}
