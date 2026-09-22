"use client";

import { Check, Sparkles, X } from "lucide-react";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import GrowingTextarea from "@/components/canvas/growing-textarea";
import { Button } from "@/components/ui/button";

/**
 * The opening line, and the alternatives still on the table, as two parts of
 * the document. The first hook is the one in use, which is what the recorder
 * and the poster read; picking another moves it to the front. Nothing here
 * generates: asking for hooks is a sentence in the chat like any other ask.
 */
export default function CanvasHooks({
  hooks,
  onChange,
  onAskForHooks,
}: {
  hooks: string[];
  onChange: (hooks: string[]) => void;
  onAskForHooks: () => void;
}) {
  const choose = (index: number) =>
    onChange([hooks[index], ...hooks.filter((_, i) => i !== index)]);
  const edit = (index: number, text: string) =>
    onChange(hooks.map((hook, i) => (i === index ? text : hook)));
  const remove = (index: number) =>
    onChange(hooks.filter((_, i) => i !== index));
  const alternatives = hooks.slice(1);

  return (
    <>
      <section>
        <CanvasSectionTitle title="Hook" />
        {hooks.length === 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAskForHooks}
            className="text-muted-foreground -ml-2"
          >
            <Sparkles className="h-4 w-4" /> Give me five hooks
          </Button>
        ) : (
          <GrowingTextarea
            value={hooks[0]}
            onChange={(event) => edit(0, event.target.value)}
            aria-label="The hook in use"
            className="text-foreground placeholder:text-muted-foreground/50 w-full text-[22px] leading-[1.3] font-semibold tracking-[-0.015em]"
          />
        )}
      </section>

      {alternatives.length > 0 && (
        <section>
          <CanvasSectionTitle
            title="Hook alternatives"
            meta={`${alternatives.length}`}
          />
          <div className="-mx-2 space-y-0.5">
            {alternatives.map((hook, offset) => {
              const index = offset + 1;
              return (
                <div
                  key={index}
                  className="group hover:bg-muted/50 flex items-start gap-3 rounded-xl px-2 py-2 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => choose(index)}
                    aria-label={`Use hook ${index + 1}`}
                    title="Use this hook"
                    className="border-border group-hover:border-foreground/40 mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-transparent transition-colors hover:border-[color:var(--sg-accent)] hover:bg-[color:var(--sg-accent)] hover:text-white"
                  >
                    <Check className="h-2.5 w-2.5" />
                  </button>
                  <GrowingTextarea
                    value={hook}
                    onChange={(event) => edit(index, event.target.value)}
                    aria-label={`Hook ${index + 1}`}
                    className="text-foreground/80 placeholder:text-muted-foreground/50 min-w-0 flex-1 text-[15px] leading-relaxed"
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
        </section>
      )}
    </>
  );
}
