"use client";

import { useEffect, useState } from "react";

/** Pause on the finished stage this long before moving on. */
const HOLD_MS = 1500;

/**
 * Steps through stages of different lengths, giving each one exactly the time
 * its own demo needs to play to the end. It runs only while `active`, and
 * `pass` changes whenever playback resumes or the viewer picks a stage, so the
 * caller can restart that stage's demo from the beginning in step with the
 * clock.
 */
export function useStageClock(durations: readonly number[], active: boolean) {
  const [stage, setStage] = useState(0);
  const [pass, setPass] = useState(0);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      setStage((current) => (current + 1) % durations.length);
      setPass((current) => current + 1);
    }, durations[stage] + HOLD_MS);
    return () => clearTimeout(timer);
  }, [active, stage, pass, durations]);

  // A demo paused off screen restarts with the clock when it comes back.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (active) setPass((current) => current + 1);
  }

  const select = (next: number) => {
    setStage(next);
    setPass((current) => current + 1);
  };
  return { stage, pass, select };
}
