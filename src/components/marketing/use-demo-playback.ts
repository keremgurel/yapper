"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/** Marketing sequences run only on screen, in a foreground tab. */
export function useDemoPlayback(frameCount = 6, interval = 1800) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
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
