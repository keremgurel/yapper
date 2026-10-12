"use client";

import { useCallback, useRef } from "react";
import { useSlosh } from "./use-slosh";
import styles from "./top-up.module.css";

/**
 * A glass tank of credits. The settled layer is what the account already
 * holds; the bright layer on top is the pack being chosen, and its surface
 * sloshes when the choice changes. Decorative: the pack choice beside it is
 * the accessible control.
 */
export default function CreditTank({
  held,
  added,
  capacity,
}: {
  held: number;
  added: number;
  capacity: number;
}) {
  const liquid = useRef<HTMLDivElement>(null);
  const toPercent = (credits: number) =>
    Math.min(100, Math.max(0, (credits / capacity) * 100));
  const heldLevel = toPercent(held);
  const total = toPercent(held + added);

  const paint = useCallback((level: number, tilt: number) => {
    const el = liquid.current;
    if (!el) return;
    const lean = (Math.tan((tilt * Math.PI) / 180) * el.offsetWidth) / 2;
    const top = 100 - level;
    el.style.clipPath = `polygon(0 calc(${top}% + ${lean}px), 100% calc(${top}% - ${lean}px), 100% 100%, 0 100%)`;
  }, []);
  useSlosh(total, paint);

  return (
    <div className={styles.tank} aria-hidden="true">
      <div ref={liquid} className={styles.added} />
      <div className={styles.held} style={{ height: `${heldLevel}%` }} />
      <div className={styles.ticks} />
    </div>
  );
}
