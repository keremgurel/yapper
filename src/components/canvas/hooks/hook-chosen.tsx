"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import CanvasSectionTitle from "@/components/canvas/canvas-section-title";
import GrowingTextarea from "@/components/canvas/growing-textarea";
import { Button } from "@/components/ui/button";

const SPRING = { type: "spring", stiffness: 420, damping: 38 } as const;

/** The opening line, at the top of the script. Set large: it is the first
 * thing said. Editable in place; swapping happens in the alternatives. */
export default function HookChosen({
  hook,
  hookKey,
  onChange,
  onAskForHooks,
}: {
  hook: string | null;
  hookKey: string | null;
  onChange: (text: string) => void;
  onAskForHooks: () => void;
}) {
  return (
    <section>
      <CanvasSectionTitle title="Hook" />
      {hook === null || hookKey === null ? (
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
        <motion.div layout layoutId={hookKey} transition={SPRING}>
          <GrowingTextarea
            value={hook}
            onChange={(event) => onChange(event.target.value)}
            aria-label="The hook in use"
            className="text-foreground placeholder:text-muted-foreground/50 w-full text-[24px] leading-[1.3] font-semibold tracking-[-0.015em]"
          />
        </motion.div>
      )}
    </section>
  );
}
