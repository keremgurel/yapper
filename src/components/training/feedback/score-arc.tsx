"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useCountUp } from "@/components/training/feedback/use-count-up";
import { useInView } from "@/components/training/feedback/use-in-view";
import styles from "@/components/training/feedback/report.module.css";

const TICKS = 41;
const CENTER = 100;
const INNER = 70;
const OUTER = 88;

/** Tick `index` of the half circle, from the left end round to the right. */
function tick(index: number) {
  const angle = Math.PI - (index / (TICKS - 1)) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // Rounded so the server and the browser print the same coordinates.
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    x1: round(CENTER + INNER * cos),
    y1: round(CENTER - INNER * sin),
    x2: round(CENTER + OUTER * cos),
    y2: round(CENTER - OUTER * sin),
  };
}

/**
 * The overall score as a half-circle of tick marks, the same marks as the
 * timer dial on the practice console. Ticks light up one after another to
 * the score while the number counts up. A low score lights fewer ticks; it
 * never changes to an alarm color.
 */
export default function ScoreArc({
  value,
  previous,
}: {
  value: number;
  /** The overall score of the last attempt at this prompt, if any. */
  previous?: number | null;
}) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const lit = Math.round((score / 100) * TICKS);
  const { ref, inView } = useInView<HTMLDivElement>();
  const shown = useCountUp(score, inView);
  const change =
    typeof previous === "number" ? score - Math.round(previous) : null;
  return (
    <div
      ref={ref}
      className={styles.arc}
      data-in-view={inView}
      role="img"
      aria-label={`Overall score ${score} out of 100${
        change
          ? `, ${change > 0 ? "up" : "down"} ${Math.abs(change)} from your last attempt`
          : ""
      }`}
    >
      <div className={styles.arcGauge}>
        <svg viewBox="0 0 200 104" aria-hidden="true">
          {Array.from({ length: TICKS }, (_, index) => (
            <line
              key={index}
              {...tick(index)}
              className={styles.arcTick}
              data-lit={index < lit}
              style={{ ["--i" as string]: index }}
            />
          ))}
        </svg>
        <div className={styles.arcValue} aria-hidden="true">
          <p>{shown}</p>
          <span>out of 100</span>
        </div>
      </div>
      {change !== null && change !== 0 && (
        <p className={styles.arcChange} data-up={change > 0} aria-hidden="true">
          {change > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(change)} since last attempt
        </p>
      )}
    </div>
  );
}
