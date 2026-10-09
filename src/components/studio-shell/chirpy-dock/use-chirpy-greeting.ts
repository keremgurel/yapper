"use client";

import { useEffect, useState } from "react";

const GREETED_KEY = "yapper:chirpy-greeted";
/** How long the creator has been on Home before Chirpy says hello. */
const GREET_AFTER_MS = 5_000;
/** How long the bubble stays up before it leaves on its own. */
const SHOW_FOR_MS = 4_500;

export type GreetingPhase = "waiting" | "showing" | "leaving" | "done";

function alreadyGreeted(): boolean {
  try {
    return window.localStorage.getItem(GREETED_KEY) === "1";
  } catch {
    return false;
  }
}

function markGreeted() {
  try {
    window.localStorage.setItem(GREETED_KEY, "1");
  } catch {
    // Blocked storage means a second hello on a later visit, nothing worse.
  }
}

/**
 * Chirpy's one hello. After five seconds on Home it dances and says "Ask me
 * anything", then the bubble leaves by itself. It happens once on this
 * device: the flag is written the moment the bubble appears, so a reload
 * mid-greeting does not replay it. Leaving Home or opening the panel before
 * the five seconds are up keeps the hello for next time.
 */
export function useChirpyGreeting(eligible: boolean) {
  const [phase, setPhase] = useState<GreetingPhase>("waiting");

  // Only time the creator can see counts: a hidden tab neither starts the
  // clock nor spends the one hello where nobody would see it.
  useEffect(() => {
    if (!eligible || phase !== "waiting") return;
    let timer: number | undefined;
    const arm = () => {
      window.clearTimeout(timer);
      if (document.hidden) return;
      timer = window.setTimeout(() => {
        if (alreadyGreeted()) {
          setPhase("done");
          return;
        }
        markGreeted();
        setPhase("showing");
      }, GREET_AFTER_MS);
    };
    arm();
    document.addEventListener("visibilitychange", arm);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", arm);
    };
  }, [eligible, phase]);

  useEffect(() => {
    if (phase !== "showing") return;
    const timer = window.setTimeout(() => setPhase("leaving"), SHOW_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Navigating away or opening the panel ends a greeting that is on screen.
  if (!eligible && phase === "showing") setPhase("leaving");

  return {
    phase,
    dismiss: () =>
      setPhase((current) => (current === "showing" ? "leaving" : current)),
    finished: () => setPhase("done"),
  };
}
