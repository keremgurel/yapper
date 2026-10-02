"use client";

import { useCountUp } from "@/components/training/feedback/use-count-up";
import styles from "@/components/training/feedback/pronunciation.module.css";

const RADIUS = 42;
const LENGTH = 2 * Math.PI * RADIUS;

/** One 0-100 score as a ring that fills while its number counts up. */
export default function RingMeter({
  value,
  label,
  hint,
  active,
  delay = 0,
}: {
  value: number;
  label: string;
  hint: string;
  /** Starts the fill, once the section is on screen. */
  active: boolean;
  delay?: number;
}) {
  const score = Math.max(0, Math.min(100, Math.round(value)));
  const shown = useCountUp(score, active);
  return (
    <div
      className={styles.ring}
      role="img"
      aria-label={`${label}: ${score} out of 100`}
    >
      <div className={styles.ringDial} aria-hidden="true">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={RADIUS} className={styles.ringTrack} />
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            className={styles.ringFill}
            strokeDasharray={LENGTH}
            style={{
              ["--rest" as string]: LENGTH * (1 - score / 100),
              ["--full" as string]: LENGTH,
              ["--delay" as string]: `${delay}ms`,
            }}
          />
        </svg>
        <span>{shown}</span>
      </div>
      <p className={styles.ringLabel}>{label}</p>
      <p className={styles.ringHint}>{hint}</p>
    </div>
  );
}
