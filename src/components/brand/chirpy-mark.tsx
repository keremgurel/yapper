import { useId } from "react";

/**
 * ChirpyMark — the compact, single-glyph version of Chirpy for tiny surfaces
 * (navbar logo, favicons, avatars). A round gradient badge with a simplified
 * face so it stays legible at ~24-32px, where the full mascot's tail and tuft
 * would turn to mush.
 *
 * One responsibility: render the Chirpy logomark at a given size.
 */
export function ChirpyMark({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const grad = `chirpymark-${uid}`;
  const ink = "#2a1a0e";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      role="img"
      aria-label="Yapper"
    >
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff6a1a" />
          <stop offset="55%" stopColor="#fb8b2e" />
          <stop offset="100%" stopColor="#f9a825" />
        </linearGradient>
      </defs>

      {/* tuft */}
      <path
        d="M17 7 q2 -5 4 -1"
        stroke={`url(#${grad})`}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {/* body */}
      <circle cx="20" cy="22" r="15" fill={`url(#${grad})`} />
      {/* eyes */}
      <circle cx="15" cy="19" r="4.4" fill="#fff" />
      <circle cx="25" cy="19" r="4.4" fill="#fff" />
      <circle cx="16.2" cy="19.8" r="1.9" fill={ink} />
      <circle cx="23.8" cy="19.8" r="1.9" fill={ink} />
      {/* brows — the determined Chirpy look */}
      <path
        d="M11.5 15 L16.5 17"
        stroke={ink}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M28.5 15 L23.5 17"
        stroke={ink}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* beak */}
      <path d="M17 24 L23 24 L20 28 Z" fill="#f7b32b" />
    </svg>
  );
}
