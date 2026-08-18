"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  DIMENSION_BLURBS,
  DIMENSION_LABELS,
  TRAINING_DIMENSIONS,
  type TrainingDimension,
  type TrainingRationales,
  type TrainingScores,
} from "@/lib/training-feedback/types";
import DimensionMeter from "@/components/training/feedback/dimension-meter";

/**
 * The five scored dimensions. On wide screens every rationale is visible; on
 * narrow ones each row toggles its rationale so the list stays scannable.
 */
export default function DimensionBreakdown({
  scores,
  rationales,
}: {
  scores: TrainingScores;
  rationales: TrainingRationales;
}) {
  const [open, setOpen] = useState<TrainingDimension | null>(null);

  return (
    <ul className="divide-border/60 divide-y">
      {TRAINING_DIMENSIONS.map((dim) => {
        const value = Math.max(0, Math.min(100, Math.round(scores[dim] ?? 0)));
        const rationale = rationales?.[dim];
        const expanded = open === dim;

        const header = (
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-foreground text-sm font-medium">
                {DIMENSION_LABELS[dim]}
              </p>
              <p className="text-foreground font-mono text-sm font-semibold tabular-nums">
                {value}
              </p>
            </div>
            <p className="text-muted-foreground mt-0.5 max-w-[60ch] text-xs">
              {DIMENSION_BLURBS[dim]}
            </p>
            <div className="mt-2.5">
              <DimensionMeter value={value} />
            </div>
          </div>
        );

        return (
          <li key={dim} className="py-4 first:pt-0 last:pb-0">
            {rationale ? (
              <>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : dim)}
                  className="flex w-full items-center gap-3 rounded-md text-left focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none lg:cursor-default"
                >
                  {header}
                  <ChevronDown
                    aria-hidden
                    className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none lg:hidden ${
                      expanded ? "rotate-180" : ""
                    }`}
                    style={{ transitionDuration: "var(--sg-dur-fast)" }}
                  />
                </button>
                <p
                  className={`text-muted-foreground mt-2 max-w-[68ch] text-sm leading-relaxed lg:block ${
                    expanded ? "block" : "hidden"
                  }`}
                >
                  {rationale}
                </p>
              </>
            ) : (
              <div className="flex items-center gap-3">{header}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
