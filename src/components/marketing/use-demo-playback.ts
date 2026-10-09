"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
const serverMotionPreference = () => false;
const motionPreference = () => window.matchMedia(motionQuery).matches;
function subscribeMotionPreference(update: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}

/** Marketing sequences run only on screen, in a foreground tab. */
export function useDemoPlayback(frameCount = 6, interval = 1800) {
  const ref = useRef<HTMLDivElement>(null);
  // Use the same first frame for SSR and hydration, then apply the preference.
  const reduced = useSyncExternalStore(
    subscribeMotionPreference,
    motionPreference,
    serverMotionPreference,
  );
  const [visible, setVisible] = useState(false);
  const [frame, setFrame] = useState(0);
  const active = visible && reduced === false;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let inView = false;
    const update = () => setVisible(inView && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting && entry.intersectionRatio >= 0.2;
        update();
      },
      { threshold: [0, 0.2] },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(
      () => setFrame((n) => (n + 1) % frameCount),
      interval,
    );
    return () => clearInterval(timer);
  }, [active, frameCount, interval]);

  return {
    ref,
    seek: setFrame,
    frame: reduced ? frameCount - 1 : frame,
    active,
    inView: visible,
    reducedMotion: reduced !== false,
  };
}
