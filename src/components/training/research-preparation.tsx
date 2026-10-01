"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./training-workspace.module.css";

export default function ResearchPreparation({
  question,
}: {
  question: string;
}) {
  const [remaining, setRemaining] = useState(900);
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  const finished = remaining === 0;
  useEffect(() => {
    if (!running || finished) return;
    const update = () =>
      setRemaining(
        Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)),
      );
    const interval = setInterval(update, 250);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [running, finished]);
  function toggle() {
    if (running && !finished) setRunning(false);
    else {
      const seconds = finished ? 900 : remaining;
      setRemaining(seconds);
      deadline.current = Date.now() + seconds * 1000;
      setRunning(true);
    }
  }
  return (
    <div className={styles.researchPrep}>
      <div>
        <span>Research time</span>
        <strong role="timer">
          {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
        </strong>
      </div>
      <p>
        Use Google Scholar, take handwritten notes, and check what you
        understand. Skip AI summaries for this exercise.
      </p>
      <div className={styles.researchActions}>
        <Button variant="outline" onClick={toggle}>
          {running && !finished ? <Pause /> : <Play />}
          {finished
            ? "Research again"
            : running
              ? "Pause research"
              : "Start research"}
        </Button>
        <a
          href={`https://scholar.google.com/scholar?q=${encodeURIComponent(question)}`}
          target="_blank"
          rel="noreferrer"
        >
          <Search size={15} /> Find sources
        </a>
      </div>
      <p aria-live="polite">
        {finished
          ? "Research time is up. Close your sources, then start your one-minute explanation."
          : "Ready sooner? Continue when you can explain the idea in your own words."}
      </p>
    </div>
  );
}
