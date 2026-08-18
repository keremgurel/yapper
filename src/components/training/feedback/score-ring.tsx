"use client";

import { useEffect, useState } from "react";

const SIZE = 132;
const STROKE = 9;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The overall score as an arc that draws in on mount. One informational hue
 * on purpose: a low score reads as a shorter arc, never as an alarm color.
 * Reduced motion skips the draw and shows the final arc immediately.
 */
export default function ScoreRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const [drawn, setDrawn] = useState(false);
  // Kick the draw from a frame callback so the empty state paints first and
  // the transition has somewhere to go.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const offset = drawn ? CIRCUMFERENCE * (1 - clamped / 100) : CIRCUMFERENCE;

  return (
    <div className="relative h-[132px] w-[132px] shrink-0">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-full w-full -rotate-90"
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className="stroke-[color:var(--sg-cyan-500)] transition-[stroke-dashoffset] motion-reduce:transition-none"
          style={{
            transitionDuration: "var(--sg-dur-slow)",
            transitionTimingFunction: "var(--sg-ease-out)",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <span className="sr-only">{`Overall score ${clamped} out of 100`}</span>
          <p
            aria-hidden
            className="text-foreground font-mono text-[26px] font-semibold tracking-[-0.01em] tabular-nums"
          >
            {clamped}
          </p>
          <p aria-hidden className="text-muted-foreground font-mono text-xs">
            of 100
          </p>
        </div>
      </div>
    </div>
  );
}
