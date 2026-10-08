"use client";

import { useState, type CSSProperties } from "react";
import type { CreditMeter } from "@/lib/billing/credit-meter";

export function creditMeterStyle(meter?: CreditMeter): CSSProperties {
  return {
    "--credit-light": meter?.lightColor ?? "#737373",
    "--credit-dark": meter?.darkColor ?? "#a3a3a3",
  } as CSSProperties;
}

/** The number in the account menu is the accessible source of truth. */
export default function CreditAvatar({
  src,
  name = "Account",
  meter,
  size = 36,
}: {
  src: string;
  name?: string;
  meter?: CreditMeter;
  size?: number;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <span
      className="credit-indicator relative inline-flex shrink-0 items-center justify-center"
      style={{ ...creditMeterStyle(meter), width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 40 40"
        className="absolute inset-0 h-full w-full -rotate-90 fill-none"
      >
        <circle
          cx="20"
          cy="20"
          r="18"
          strokeWidth="3"
          className="stroke-foreground/15"
        />
        {meter?.fraction != null && (
          <circle
            cx="20"
            cy="20"
            r="18"
            pathLength="100"
            strokeWidth="3"
            stroke="currentColor"
            strokeLinecap="round"
            strokeDasharray={`${Math.max(1, meter.fraction * 100)} 100`}
          />
        )}
      </svg>
      <span
        className="bg-muted text-foreground relative flex items-center justify-center overflow-hidden rounded-full font-semibold"
        style={{ width: size * 0.7, height: size * 0.7, fontSize: size * 0.3 }}
      >
        {name.slice(0, 1).toUpperCase()}
        {src && src !== failedSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setFailedSrc(src)}
          />
        )}
      </span>
    </span>
  );
}
