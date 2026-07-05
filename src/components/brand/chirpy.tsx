"use client";

import { useId } from "react";

/**
 * Chirpy — Yapper's mascot. "Yapper" = a bird that won't stop chirping, so the
 * beak (the yap) is the hero. Its personality lives in a few swappable parts
 * (brows / eyes / beak), so one bird covers many scenarios (empty states,
 * loading, celebration).
 *
 * One responsibility: render Chirpy at a given expression + talking state.
 * Promoted from the /style-guide draft into a shared brand component.
 */

export type ChirpyExpression =
  | "idle"
  | "yap"
  | "happy"
  | "wink"
  | "curious"
  | "oops";

const BROWS: Record<string, [string, string]> = {
  determined: ["M64 74 L96 86", "M138 74 L106 86"],
  raised: ["M66 76 L96 70", "M136 76 L106 70"],
  worried: ["M66 84 L96 74", "M136 84 L104 74"],
  curiousL: ["M66 76 L96 70", "M138 74 L106 86"],
};

const EXPR: Record<
  ChirpyExpression,
  {
    brows: [string, string];
    eyes: "dots" | "happy" | "wink";
    beakOpen: boolean;
  }
> = {
  idle: { brows: BROWS.determined, eyes: "dots", beakOpen: false },
  yap: { brows: BROWS.determined, eyes: "dots", beakOpen: true },
  happy: { brows: BROWS.raised, eyes: "happy", beakOpen: true },
  wink: { brows: BROWS.determined, eyes: "wink", beakOpen: false },
  curious: { brows: BROWS.curiousL, eyes: "dots", beakOpen: false },
  oops: { brows: BROWS.worried, eyes: "dots", beakOpen: false },
};

export function Chirpy({
  expression = "idle",
  talking = false,
  size = 150,
  className,
}: {
  expression?: ChirpyExpression;
  talking?: boolean;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const grad = `chirpy-${uid}`;
  const beak = "#f7b32b";
  const beakDark = "#e0901a";
  const ink = "#2a1a0e";
  const e = EXPR[expression];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      className={className}
      role="img"
      aria-label="Chirpy, the Yapper mascot"
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6a1a" />
          <stop offset="55%" stopColor="#fb8b2e" />
          <stop offset="100%" stopColor="#f9a825" />
        </linearGradient>
      </defs>

      <ellipse cx="100" cy="184" rx="46" ry="7" fill="rgba(0,0,0,0.16)" />

      <g
        className={talking ? "chirpy-bob" : undefined}
        style={{ transformOrigin: "100px 108px" }}
      >
        {/* tail feathers */}
        <path d="M150 96 L184 84 L170 108 Z" fill={`url(#${grad})`} />
        <path
          d="M152 112 L186 112 L166 128 Z"
          fill={`url(#${grad})`}
          opacity="0.9"
        />
        {/* head tuft */}
        <path
          d="M84 52 q6 -26 16 -6"
          stroke={`url(#${grad})`}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M104 48 q8 -24 18 -2"
          stroke={`url(#${grad})`}
          strokeWidth="12"
          strokeLinecap="round"
          fill="none"
        />
        {/* body */}
        <ellipse cx="98" cy="112" rx="68" ry="64" fill={`url(#${grad})`} />
        {/* cream belly */}
        <ellipse
          cx="96"
          cy="138"
          rx="40"
          ry="32"
          fill="#fff3e0"
          opacity="0.85"
        />

        {/* eyes */}
        {e.eyes === "happy" ? (
          <>
            <path
              d="M70 100 q11 -13 22 0"
              stroke={ink}
              strokeWidth="6.5"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M108 100 q11 -13 22 0"
              stroke={ink}
              strokeWidth="6.5"
              strokeLinecap="round"
              fill="none"
            />
          </>
        ) : (
          <>
            <circle cx="82" cy="94" r="21" fill="#fff" />
            <circle cx="120" cy="94" r="21" fill="#fff" />
            {e.eyes === "wink" ? (
              <path
                d="M72 94 q10 -8 20 0"
                stroke={ink}
                strokeWidth="6.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <circle cx="88" cy="96" r="8.5" fill={ink} />
            )}
            <circle cx="114" cy="96" r="8.5" fill={ink} />
          </>
        )}

        {/* brows */}
        <path
          d={e.brows[0]}
          stroke={ink}
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d={e.brows[1]}
          stroke={ink}
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* beak */}
        {e.beakOpen ? (
          <>
            <path d="M86 118 L114 118 L100 130 Z" fill={beak} />
            <g
              className={talking ? "chirpy-beak" : undefined}
              style={{ transformOrigin: "100px 134px" }}
            >
              <path d="M89 134 L111 134 L100 146 Z" fill={beakDark} />
            </g>
          </>
        ) : (
          <path d="M90 120 L110 120 L100 133 Z" fill={beak} />
        )}
      </g>

      <style>{`
        @keyframes chirpyBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes chirpyBeak { 0%,100%{transform:scaleY(0.6)} 50%{transform:scaleY(1.15)} }
        .chirpy-bob { animation: chirpyBob 2.6s var(--sg-ease-in-out, ease-in-out) infinite; }
        .chirpy-beak { animation: chirpyBeak 0.42s steps(2,end) infinite; }
        @media (prefers-reduced-motion: reduce){ .chirpy-bob,.chirpy-beak{animation:none} }
      `}</style>
    </svg>
  );
}
