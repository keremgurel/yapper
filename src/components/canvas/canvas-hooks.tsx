"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The opening line, and the alternatives still on the table.
 *
 * The first hook is the one in use, which is what the recorder and the poster
 * already read. Picking another moves it to the front. Nothing here generates:
 * asking for hooks is a sentence in the prompt bar like any other ask.
 */
export default function CanvasHooks({
  hooks,
  onChange,
}: {
  hooks: string[];
  onChange: (hooks: string[]) => void;
}) {
  if (hooks.length === 0) return null;
  const choose = (index: number) =>
    onChange([hooks[index], ...hooks.filter((_, i) => i !== index)]);
  const edit = (index: number, text: string) =>
    onChange(hooks.map((hook, i) => (i === index ? text : hook)));
  const remove = (index: number) =>
    onChange(hooks.filter((_, i) => i !== index));

  return (
    <div>
      <p className="text-muted-foreground mb-1 text-[11px] font-bold tracking-[0.1em] uppercase">
        Hook{hooks.length > 1 ? ` · ${hooks.length} options` : ""}
      </p>
      <div className="space-y-1">
        {hooks.map((hook, index) => {
          const chosen = index === 0;
          return (
            <div
              key={index}
              className={`group flex items-start gap-2.5 rounded-lg px-2 py-1.5 ${
                chosen ? "bg-muted" : "hover:bg-muted/60"
              }`}
            >
              <button
                type="button"
                onClick={() => choose(index)}
                aria-label={
                  chosen ? "The hook in use" : `Use hook ${index + 1}`
                }
                aria-pressed={chosen}
                className={`mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  chosen
                    ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
                    : "border-border group-hover:border-foreground/40"
                }`}
              >
                {chosen && <Check className="h-2.5 w-2.5" />}
              </button>
              <textarea
                value={hook}
                rows={1}
                onChange={(event) => edit(index, event.target.value)}
                aria-label={`Hook ${index + 1}`}
                className={`placeholder:text-muted-foreground/50 min-w-0 flex-1 resize-none bg-transparent outline-none ${
                  chosen
                    ? "text-foreground text-[17px] leading-snug font-semibold"
                    : "text-muted-foreground text-[15px]"
                }`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => remove(index)}
                aria-label={`Remove hook ${index + 1}`}
                className="text-muted-foreground hover:text-destructive opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
              >
                <X />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
