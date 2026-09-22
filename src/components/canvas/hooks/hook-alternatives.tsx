"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";

const SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

/**
 * The openers still on the table, each a card. Click one and it lifts into
 * the Hook slot while the old opener slides down here, every line keeping
 * its element on the way. Editing happens in the Hook slot; here you choose.
 * The last card asks Chirpy for more.
 */
export default function HookAlternatives({
  hooks,
  keys,
  onUse,
  onRemove,
  onMore,
}: {
  /** The alternatives only: every hook after the chosen one. */
  hooks: string[];
  keys: string[];
  onUse: (offset: number) => void;
  onRemove: (offset: number) => void;
  onMore: () => void;
}) {
  return (
    <section>
      <CanvasSectionTitle
        title="Hook alternatives"
        meta={hooks.length ? `${hooks.length}` : undefined}
      />
      <div className="space-y-2">
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
              className="group relative"
            >
              <button
                type="button"
                onClick={() => onUse(offset)}
                title="Use this hook"
                className="bg-card border-border hover:border-foreground/25 hover:bg-muted/60 text-foreground/85 hover:text-foreground w-full cursor-pointer rounded-xl border px-4 py-3 pr-9 text-left text-[14px] leading-relaxed transition-[background-color,border-color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none active:scale-[0.99]"
              >
                {hook}
              </button>
              <button
                type="button"
                onClick={() => onRemove(offset)}
                aria-label="Remove this hook"
                title="Remove"
                className="text-muted-foreground hover:bg-muted hover:text-destructive absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-md opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
        <button
          type="button"
          onClick={onMore}
          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex w-full cursor-pointer items-center gap-2 rounded-xl px-4 py-3 text-left text-[14px] transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          {hooks.length
            ? "Ask Chirpy for more openers"
            : "Ask Chirpy for openers"}
        </button>
      </div>
    </section>
  );
}
