"use client";

import { useEffect, useState } from "react";

/**
 * A horizontal 0-100 meter. Fills via a scaleX transform rather than a width
 * animation, in the same informational hue as the score ring; the number next
 * to it carries the value, so the bar never needs a severity ramp.
 */
export default function DimensionMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const [drawn, setDrawn] = useState(false);
  // Kick the draw from a frame callback so the empty state paints first and
  // the transition has somewhere to go.
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      aria-hidden
      className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
    >
      <div
        className="h-full origin-left rounded-full bg-[color:var(--sg-cyan-500)] transition-transform motion-reduce:transition-none"
        style={{
          transform: `scaleX(${drawn ? clamped / 100 : 0})`,
          transitionDuration: "var(--sg-dur-slow)",
          transitionTimingFunction: "var(--sg-ease-out)",
        }}
      />
    </div>
  );
}
