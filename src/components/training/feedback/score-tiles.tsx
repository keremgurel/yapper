"use client";

import { useState } from "react";
import {
  SKILL_BLURBS,
  SKILL_LABELS,
  SKILLS,
  type Skill,
  type SkillScores,
} from "@/lib/training-feedback/skills";
import { useInView } from "@/components/training/feedback/use-in-view";
import styles from "@/components/training/feedback/report.module.css";

/**
 * The four skills side by side, so they can be compared at a glance. One is
 * always open below with the reason for its number; it starts on the lowest
 * score, because that is the one worth reading first.
 */
export default function ScoreTiles({
  skills,
  reasons,
}: {
  skills: SkillScores;
  reasons: Record<Skill, string>;
}) {
  const measured = SKILLS.filter((skill) => skills[skill] !== null);
  const lowest = measured.reduce((low, skill) =>
    skills[skill]! < skills[low]! ? skill : low,
  );
  const [open, setOpen] = useState<Skill>(lowest);
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} data-in-view={inView}>
      <div className={styles.tiles} role="tablist" aria-label="Scores">
        {SKILLS.map((skill, index) => {
          const value = skills[skill];
          return (
            <button
              key={skill}
              type="button"
              role="tab"
              id={`score-tab-${skill}`}
              aria-selected={open === skill}
              aria-controls="score-panel"
              className={styles.tile}
              onClick={() => setOpen(skill)}
            >
              <span className={styles.tileLabel}>{SKILL_LABELS[skill]}</span>
              <span className={styles.tileValue} data-empty={value === null}>
                {value ?? "Not measured"}
              </span>
              <span className={styles.tileMeter} aria-hidden="true">
                <i
                  style={{
                    width: `${value ?? 0}%`,
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
        <p>
          {skills[open] === null
            ? "Your voice could not be measured on this recording, so there is no score for it. The other three are unaffected."
            : reasons[open] ||
              (open === "expressive"
                ? "Measured from your audio. The pronunciation section below shows where your pitch moved and where it stayed flat."
                : SKILL_BLURBS[open])}
        </p>
        <p className={styles.tileBlurb}>
          {SKILL_LABELS[open]} is {SKILL_BLURBS[open].charAt(0).toLowerCase()}
          {SKILL_BLURBS[open].slice(1)}
        </p>
      </div>
    </div>
  );
}
