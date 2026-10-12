"use client";

import { useRef, type KeyboardEvent } from "react";
import type { CreditPack } from "@/lib/billing/plans";
import {
  centsPerCredit,
  finishedVideos,
  referenceAnalyses,
} from "@/lib/billing/credit-equivalents";
import styles from "./top-up.module.css";

function covers(credits: number) {
  const videos = finishedVideos(credits);
  const refs = referenceAnalyses(credits);
  const videoText =
    videos === 0
      ? "Part of a finished video"
      : `About ${videos} finished video${videos === 1 ? "" : "s"}`;
  return `${videoText}, or ${refs} reference transcripts`;
}

/** The three packs as one radio group. Arrow keys move the choice, the way a
 * native radio group does, so the whole list is one tab stop. */
export default function PackChoice({
  packs,
  value,
  onChange,
}: {
  packs: CreditPack[];
  value: CreditPack["key"];
  onChange: (key: CreditPack["key"]) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const bestRate = packs.reduce((best, pack) =>
    (centsPerCredit(pack) ?? Infinity) < (centsPerCredit(best) ?? Infinity)
      ? pack
      : best,
  );

  const move = (event: KeyboardEvent, index: number) => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + packs.length) % packs.length;
    onChange(packs[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.choices} role="radiogroup" aria-label="Credit pack">
      {packs.map((pack, index) => {
        const selected = pack.key === value;
        const cents = centsPerCredit(pack);
        return (
          <button
            key={pack.key}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            className={styles.choice}
            onClick={() => onChange(pack.key)}
            onKeyDown={(event) => move(event, index)}
          >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.choiceText}>
              <span className={styles.choiceName}>
                {pack.credits.toLocaleString()} credits
                {pack.key === bestRate.key && (
                  <span className={styles.badge}>Best rate</span>
                )}
              </span>
              <span className={styles.choiceCovers}>
                {covers(pack.credits)}
              </span>
            </span>
            <span className={styles.choicePrice}>
              <strong>{pack.priceLabel}</strong>
              {cents !== null && <span>{cents.toFixed(1)}¢ each</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
