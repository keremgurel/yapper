"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Sparkles, X } from "lucide-react";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import GrowingTextarea from "@/components/canvas/growing-textarea";
import { Button } from "@/components/ui/button";

const SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

/**
 * The openers still on the table. "Use" lifts one into the Hook slot and the
 * old opener slides down here, each line keeping its element on the way. More
 * come from Chirpy, in one ask.
 */
export default function HookAlternatives({
  hooks,
  keys,
  onUse,
  onEdit,
  onRemove,
  onMore,
}: {
  /** The alternatives only: every hook after the chosen one. */
  hooks: string[];
  keys: string[];
  onUse: (offset: number) => void;
  onEdit: (offset: number, text: string) => void;
  onRemove: (offset: number) => void;
  onMore: () => void;
}) {
  return (
    <section>
      <CanvasSectionTitle
        title="Hook alternatives"
        meta={hooks.length ? `${hooks.length}` : undefined}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onMore}
            className="text-muted-foreground"
            title="Ask Chirpy for more openers"
          >
            <Sparkles className="h-3 w-3" /> More
          </Button>
        }
      />
      {hooks.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No other openers yet. Ask for more and pick the strongest.
        </p>
      ) : (
        <div className="-mx-2">
          <AnimatePresence initial={false}>
            {hooks.map((hook, offset) => (
              <motion.div
                key={keys[offset]}
                layout
                layoutId={keys[offset]}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={SPRING}
                className="group hover:bg-muted/50 flex items-start gap-2 rounded-xl px-2 py-2 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onUse(offset)}
                  aria-label={`Use this hook`}
                  title="Use this hook"
                  className="border-border text-muted-foreground group-hover:border-foreground/40 mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors hover:border-[color:var(--sg-accent)] hover:bg-[color:var(--sg-accent)] hover:text-white"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <GrowingTextarea
                  value={hook}
                  onChange={(event) => onEdit(offset, event.target.value)}
                  aria-label={`Alternative hook ${offset + 1}`}
                  className="text-foreground/85 min-w-0 flex-1 text-[14px] leading-relaxed"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => onRemove(offset)}
                  aria-label="Remove this hook"
                  className="text-muted-foreground hover:text-destructive opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  <X />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
