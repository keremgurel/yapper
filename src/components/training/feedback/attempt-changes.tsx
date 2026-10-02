import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import {
  changeDirection,
  type AttemptChange,
} from "@/components/training/feedback/attempt-comparison";

const TONE = {
  improved: "text-[color:var(--sg-green-600,#1f8a4c)]",
  worse: "text-muted-foreground",
  same: "text-muted-foreground",
} as const;

/** What moved since the last attempt at this prompt. A drop is shown plainly
 * but never in an alarm color: one worse number is not a failure. */
export default function AttemptChanges({
  changes,
}: {
  changes: AttemptChange[];
}) {
  if (changes.length === 0) return null;
  return (
    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {changes.map((change) => {
        const direction = changeDirection(change);
        const Icon =
          change.after === change.before
            ? Minus
            : change.after > change.before
              ? ArrowUp
              : ArrowDown;
        return (
          <div
            key={change.label}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="text-muted-foreground text-sm">{change.label}</dt>
            <dd className="flex items-center gap-2 font-mono text-sm tabular-nums">
              <span className="text-muted-foreground">{change.before}</span>
              <Icon size={13} aria-hidden className={TONE[direction]} />
              <span className={`font-semibold ${TONE[direction]}`}>
                {change.after}
              </span>
              <span className="sr-only">
                {direction === "same" ? "no change" : direction}
              </span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
