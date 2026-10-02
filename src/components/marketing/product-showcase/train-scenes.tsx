"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  BriefcaseBusiness,
  MessageCircle,
  Mic,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  DIMENSION_LABELS,
  TRAINING_DIMENSIONS,
} from "@/lib/training-feedback/types";
import styles from "./product-showcase.module.css";

const EXERCISES = [
  { label: "Random topic", Icon: Shuffle },
  { label: "Interview answers", Icon: BriefcaseBusiness },
  { label: "Read aloud", Icon: BookOpen },
  { label: "Hard conversations", Icon: MessageCircle },
];
const PROMPT = "What’s something you changed your mind about recently?";
// Sample scores for the demonstration, one per real feedback dimension.
const SAMPLE_SCORES = [74, 81, 68, 62, 70];

/** The countdown ring. `from` and `to` are fractions of the minute left; the
 * sweep between them runs for as long as the scene is on screen. */
function Ring({
  from,
  to,
  children,
}: {
  from: number;
  to: number;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.ring}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="54" />
        <circle
          cx="60"
          cy="60"
          r="54"
          pathLength="100"
          strokeDasharray="100"
          style={{
            ["--ring-from" as string]: 100 - from * 100,
            ["--ring-to" as string]: 100 - to * 100,
          }}
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}

export function ChooseScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.sceneTitle}>What do you want to practice?</p>
      <ul className={styles.deck}>
        {EXERCISES.map(({ label, Icon }, index) => (
          <li key={label} data-picked={index === 0}>
            <Icon size={20} aria-hidden="true" />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PromptScene() {
  return (
    <div className={styles.scene}>
      <p className={styles.chip}>
        <Shuffle size={13} aria-hidden="true" /> Random topic
      </p>
      <p className={styles.prompt}>{PROMPT}</p>
      <Ring from={1} to={1}>
        1:00
      </Ring>
      <p className={styles.start}>
        <Mic size={15} aria-hidden="true" /> Start speaking
      </p>
    </div>
  );
}

/** Seconds left, ticking once a second while the scene is mounted. */
function useTicking(start: number) {
  const [seconds, setSeconds] = useState(start);
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds((left) => Math.max(0, left - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);
  return seconds;
}

export function SpeakScene() {
  const seconds = useTicking(42);
  return (
    <div className={styles.scene}>
      <p className={`${styles.chip} ${styles.live}`}>
        <i aria-hidden="true" /> Recording
      </p>
      <p className={styles.prompt}>{PROMPT}</p>
      <Ring from={42 / 60} to={38 / 60}>
        0:{String(seconds).padStart(2, "0")}
      </Ring>
      <p className={styles.sceneNote}>Keep going. Say it your way.</p>
    </div>
  );
}

export function FeedbackScene() {
  return (
    <div className={`${styles.scene} ${styles.feedback}`}>
      <p className={styles.chip}>
        <Sparkles size={13} aria-hidden="true" /> Your feedback
      </p>
      <dl className={styles.scores}>
        {TRAINING_DIMENSIONS.map((dimension, index) => (
          <div
            key={dimension}
            style={{ ["--delay" as string]: `${index * 110}ms` }}
          >
            <dt>{DIMENSION_LABELS[dimension]}</dt>
            <dd>
              <span>
                <i style={{ width: `${SAMPLE_SCORES[index]}%` }} />
              </span>
              <b>{SAMPLE_SCORES[index]}</b>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.focus}>
        <strong>Next attempt.</strong> Say your point in the first sentence,
        then give one example.
      </p>
    </div>
  );
}
