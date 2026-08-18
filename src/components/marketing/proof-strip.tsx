import { topics } from "@/data/topics";
import { programFamilies } from "@/data/training";
import { TRAINING_DIMENSIONS } from "@/lib/training-feedback/types";
import { WELCOME_CREDITS } from "@/lib/db/constants";

/**
 * Real figures only. Every number here is derived from the thing it counts, so
 * it cannot drift and none of it is the sort of user-count boast the product
 * has not earned yet.
 */
const FIGURES: [string, string][] = [
  [topics.length.toLocaleString(), "speaking prompts"],
  [String(programFamilies.length), "practice drills"],
  [String(TRAINING_DIMENSIONS.length), "dimensions scored"],
  [String(WELCOME_CREDITS), "free credits to start"],
];

export default function ProofStrip() {
  return (
    <div className="border-border bg-card divide-border grid rounded-2xl border sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
      {FIGURES.map(([value, label]) => (
        <div key={label} className="px-6 py-7 text-center">
          <p className="text-foreground font-mono text-[30px] leading-none font-semibold tabular-nums">
            {value}
          </p>
          <p className="text-muted-foreground mt-2 text-[13px]">{label}</p>
        </div>
      ))}
    </div>
  );
}
