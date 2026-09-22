"use client";

import { Check, Sparkles, X } from "lucide-react";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
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
  onAskForHooks,
}: {
  hooks: string[];
  onChange: (hooks: string[]) => void;
  /** Sends "Give me five hooks" to Chirpy; shown when there are none yet. */
  onAskForHooks: () => void;
}) {
  if (hooks.length === 0) {
    return (
      <div>
        <CanvasSectionTitle title="Hooks" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAskForHooks}
          className="text-muted-foreground -ml-2"
        >
          <Sparkles className="h-4 w-4" /> Give me five hooks
        </Button>
      </div>
    );
  }
  const choose = (index: number) =>
    onChange([hooks[index], ...hooks.filter((_, i) => i !== index)]);
  const edit = (index: number, text: string) =>
    onChange(hooks.map((hook, i) => (i === index ? text : hook)));
  const remove = (index: number) =>
    onChange(hooks.filter((_, i) => i !== index));

  return (
    <div>
      <CanvasSectionTitle
        title="Hooks"
        meta={hooks.length > 1 ? `${hooks.length} to choose from` : undefined}
      />
      <div className="-mx-2 space-y-0.5">
        {hooks.map((hook, index) => {
          const chosen = index === 0;
          return (
            <div
              key={index}
              className={`group flex items-start gap-3 rounded-xl px-2 py-2 transition-colors ${
                chosen ? "bg-muted" : "hover:bg-muted/50"
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
