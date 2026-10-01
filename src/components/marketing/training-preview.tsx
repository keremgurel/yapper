"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Pause, Play, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoPlayback } from "./use-demo-playback";
import styles from "./train-product.module.css";

const prompts = [
  "What’s a small decision that made a big difference in your life?",
  "What’s something you changed your mind about recently?",
  "If you could teach one thing to a friend, what would it be?",
  "What’s one ordinary moment you wish you could relive?",
];

export default function TrainingPreview() {
  const [prompt, setPrompt] = useState(0);
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const { ref, inView } = useDemoPlayback(1);
  const finished = seconds === 0;
  useEffect(() => {
    if (!running || !inView || finished) return;
    const timer = setInterval(() => {
      setSeconds((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [running, inView, finished]);
  const counting = running && !finished;
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  function toggleTimer() {
    if (finished) {
      setSeconds(60);
      setRunning(true);
    } else setRunning(!running);
  }
  function nextPrompt() {
    setPrompt((current) => (current + 1) % prompts.length);
    setSeconds(60);
    setRunning(false);
  }

  return (
    <div ref={ref} className={styles.practiceField}>
      <div className={styles.practiceWindow}>
        <div className={styles.windowHeading}>
          <span>
            <strong>yapper</strong> train
          </span>
          <span className={styles.sessionLabel}>Speaking practice</span>
        </div>
        <div className={styles.promptBody}>
          <div className={styles.promptMeta}>
            <span>Something to think about</span>
          </div>
          <p className={styles.promptText} aria-live="polite">
            {prompts[prompt]}
          </p>
          <div className={styles.timerArea}>
            <div className={styles.timer}>
              <svg viewBox="0 0 104 104" aria-hidden="true">
                <circle cx="52" cy="52" r="48" />
                <circle
                  cx="52"
                  cy="52"
                  r="48"
                  pathLength="60"
                  strokeDasharray="60"
                  strokeDashoffset={60 - seconds}
                />
              </svg>
              <span role="timer" aria-label={`${seconds} seconds remaining`}>
                {time}
              </span>
            </div>
            <div>
              <strong>
                {finished
                  ? "You made time for your voice."
                  : counting
                    ? "Go on. Say it your way."
                    : "One minute. Just you."}
              </strong>
              <p aria-live="polite">
                {finished
                  ? "Try it again, or take a new topic."
                  : counting
                    ? "No script. No perfect answer."
                    : "Speak out loud and see where it takes you."}
              </p>
            </div>
          </div>
          <div className={styles.promptControls}>
            <Button
              variant="secondary"
              onClick={toggleTimer}
              className={styles.timerButton}
            >
              {finished ? <RotateCcw /> : counting ? <Pause /> : <Play />}
              {finished
                ? "Try again"
                : counting
                  ? "Pause timer"
                  : seconds < 60
                    ? "Resume timer"
                    : "Start the timer"}
            </Button>
            <Button variant="ghost" onClick={nextPrompt}>
              <Shuffle /> New topic
            </Button>
          </div>
        </div>
      </div>
      <div className={styles.practiceFootnote}>
        <span>No recording. Just a moment to practice.</span>
        <ArrowRight size={16} aria-hidden="true" />
      </div>
    </div>
  );
}
