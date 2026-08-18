"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Fades and lifts a section into place the first time it enters the viewport.
 *
 * This is the one ambient motion on the marketing pages, and it earns its
 * place under "preventing jarring change": long pages otherwise snap fully
 * formed content into view mid-scroll. It fires once, moves only transform and
 * opacity, finishes well under 300ms, and does nothing at all when the reader
 * has asked for reduced motion.
 */
export default function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Reduced motion is handled in CSS below, so this only has to cope with
    // the browser lacking an observer. Showing on the next frame keeps the
    // state change out of the effect body.
    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
          }
        }
      },
      // Start a little before the section is fully on screen, so the movement
      // has finished by the time it is actually being read.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:!transition-none ${className ?? ""}`}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "none" : "translateY(12px)",
        transition: `opacity 280ms var(--sg-ease-out, ease-out) ${delayMs}ms, transform 280ms var(--sg-ease-out, ease-out) ${delayMs}ms`,
      }}
    >
      {children}
    </div>
  );
}
