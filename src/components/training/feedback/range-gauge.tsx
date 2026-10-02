"use client";

import { useCountUp } from "@/components/training/feedback/use-count-up";
import { useInView } from "@/components/training/feedback/use-in-view";
import styles from "@/components/training/feedback/report.module.css";

/**
 * One measured number on a scale, with the range to aim for shaded. The
 * verdict says in words what the position means, so the gauge never has to
 * be decoded.
 */
export default function RangeGauge({
  label,
  value,
  unit,
  min,
  max,
  target,
  verdict,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  /** The range to aim for, in the same units as `value`. */
  target: [number, number];
  verdict: string;
}) {
  const place = (n: number) =>
    `${((Math.min(max, Math.max(min, n)) - min) / (max - min)) * 100}%`;
  const inTarget = value >= target[0] && value <= target[1];
  const { ref, inView } = useInView<HTMLDivElement>();
  const shown = useCountUp(value, inView, {
    decimals: Number.isInteger(value) ? 0 : 1,
  });
  return (
    <div ref={ref} className={styles.gauge} data-in-view={inView}>
      <p className={styles.gaugeLabel}>{label}</p>
      <p className={styles.gaugeValue}>
        {shown}
        <span>{unit}</span>
      </p>
      <div
        className={styles.gaugeTrack}
        role="img"
        aria-label={`${value} ${unit}. Aim for ${target[0]} to ${target[1]}.`}
      >
        <span
          className={styles.gaugeTarget}
          style={{
            left: place(target[0]),
            width: `calc(${place(target[1])} - ${place(target[0])})`,
          }}
        />
        <span
          className={styles.gaugeMarker}
          data-in-target={inTarget}
          style={{ ["--at" as string]: place(value) }}
        />
      </div>
      <div className={styles.gaugeScale}>
        <span>{min}</span>
        <span>
          Aim for {target[0]} to {target[1]}
        </span>
        <span>{max}+</span>
      </div>
      <p className={styles.gaugeVerdict}>{verdict}</p>
    </div>
  );
}
