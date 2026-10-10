"use client";

import { motion } from "framer-motion";
import { useAutoAdvance } from "../use-auto-advance";
import { STEPS } from "./steps";
import styles from "./step-stack.module.css";

/** How many cards peek out behind the top one. */
const VISIBLE = 3;
const DWELL_MS = 3200;

/**
 * The sign-in page's left side: one card per Studio step, stacked, the top
 * one moving to the back every few seconds. The step pills under it jump to a
 * card and stop the cycle.
 */
export default function StepStack() {
  const { current, choose } = useAutoAdvance(STEPS, DWELL_MS);
  const top = STEPS.indexOf(current);

  return (
    <div className={styles.root}>
      <div className={styles.deck} aria-live="polite">
        {STEPS.map((step, i) => {
          const depth = (i - top + STEPS.length) % STEPS.length;
          const hidden = depth >= VISIBLE;
          return (
            <motion.article
              key={step.id}
              className={styles.card}
              aria-hidden={depth !== 0}
              initial={false}
              animate={{
                y: hidden ? 36 : depth * 14,
                scale: 1 - Math.min(depth, VISIBLE) * 0.05,
                opacity: hidden ? 0 : 1 - depth * 0.28,
              }}
              style={{ zIndex: STEPS.length - depth }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
            >
              <header className={styles.cardHeader}>
                <span className={styles.tile} data-tone={step.tone}>
                  <step.Icon size={16} strokeWidth={1.75} aria-hidden />
                </span>
                <span className={styles.cardTitle}>{step.title}</span>
              </header>
              <step.Body />
            </motion.article>
          );
        })}
      </div>
      <div className={styles.pills} role="group" aria-label="Studio steps">
        {STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            aria-pressed={step === current}
            onClick={() => choose(step)}
            className={styles.pill}
          >
            {step.label}
          </button>
        ))}
      </div>
    </div>
  );
}
