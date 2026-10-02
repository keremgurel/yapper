"use client";

import { useState } from "react";
import {
  DIMENSION_BLURBS,
  DIMENSION_LABELS,
  TRAINING_DIMENSIONS,
  type TrainingDimension,
  type TrainingRationales,
  type TrainingScores,
} from "@/lib/training-feedback/types";
import { useInView } from "@/components/training/feedback/use-in-view";
import styles from "@/components/training/feedback/report.module.css";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n ?? 0)));

/**
 * The five scores side by side, so they can be compared at a glance. One is
 * always open below with the reason for its number; it starts on the lowest
 * score, because that is the one worth reading first.
 */
export default function ScoreTiles({
  scores,
  rationales,
}: {
  scores: TrainingScores;
  rationales: TrainingRationales;
}) {
  const lowest = TRAINING_DIMENSIONS.reduce((low, dimension) =>
    clamp(scores[dimension]) < clamp(scores[low]) ? dimension : low,
  );
  const [open, setOpen] = useState<TrainingDimension>(lowest);
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-in-view={inView}>
      <div className={styles.tiles} role="tablist" aria-label="Scores">
        {TRAINING_DIMENSIONS.map((dimension, index) => {
          const value = clamp(scores[dimension]);
          return (
            <button
              key={dimension}
              type="button"
              role="tab"
              id={`score-tab-${dimension}`}
              aria-selected={open === dimension}
              aria-controls="score-panel"
              className={styles.tile}
              onClick={() => setOpen(dimension)}
            >
              <span className={styles.tileValue}>{value}</span>
              <span className={styles.tileLabel}>
                {DIMENSION_LABELS[dimension]}
              </span>
              <span className={styles.tileMeter} aria-hidden="true">
                <i
                  style={{
                    width: `${value}%`,
                    ["--delay" as string]: `${index * 90}ms`,
                  }}
                />
              </span>
            </button>
          );
        })}
      </div>
      <div
        id="score-panel"
        role="tabpanel"
        aria-labelledby={`score-tab-${open}`}
        className={styles.tilePanel}
      >
        <p>{rationales?.[open] || DIMENSION_BLURBS[open]}</p>
        <p className={styles.tileBlurb}>
          {DIMENSION_LABELS[open]} looks at:{" "}
          {DIMENSION_BLURBS[open].replace(/\.$/, "").toLowerCase()}.
        </p>
      </div>
    </div>
  );
}
