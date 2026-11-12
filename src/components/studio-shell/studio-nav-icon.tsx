import type { ReactNode } from "react";
import type { StudioIcon } from "@/data/studio-nav";

/**
 * Studio's own navigation glyphs. One 20px grid, one 1.6px rounded stroke, and
 * soft geometric forms, so the rail reads as a single family instead of a
 * handful of stock icons. Each glyph is drawn in `currentColor`.
 */
const glyphs: Record<StudioIcon, ReactNode> = {
  home: (
    <>
      <path d="M3.5 9.2 10 3.6l6.5 5.6v5.3a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2Z" />
      <path d="M7.6 13.4h4.8" />
    </>
  ),
  brain: (
    <>
      <path d="M10 4.4a2.6 2.6 0 0 0-4.6 1.1 2.7 2.7 0 0 0-1.7 4.2 2.8 2.8 0 0 0 1.2 4.2A2.6 2.6 0 0 0 10 15.4Z" />
      <path d="M10 4.4a2.6 2.6 0 0 1 4.6 1.1 2.7 2.7 0 0 1 1.7 4.2 2.8 2.8 0 0 1-1.2 4.2A2.6 2.6 0 0 1 10 15.4Z" />
      <path d="M7.3 9.3h1.2M11.5 11.5h1.200" />
    </>
  ),
  library: (
    <>
      <rect x="3.5" y="3.5" width="5.4" height="5.4" rx="1.6" />
      <rect x="11.1" y="3.5" width="5.4" height="5.4" rx="2.7" />
      <rect x="3.5" y="11.1" width="5.4" height="5.4" rx="2.7" />
      <rect x="11.1" y="11.1" width="5.4" height="5.4" rx="1.6" />
    </>
  ),
  layers: (
    <>
      <rect x="4" y="3.5" width="12" height="9" rx="2.2" />
      <path d="M6.2 15h7.6M8.2 17.2h3.6" />
    </>
  ),
  record: (
    <>
      <rect x="2.8" y="5.4" width="10.4" height="9.2" rx="2.4" />
      <path d="m13.2 9 3.1-1.9a.6.6 0 0 1 .9.5v4.8a.6.6 0 0 1-.9.5L13.2 11" />
      <circle cx="6.4" cy="8.6" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  scissors: (
    <>
      <circle cx="5.6" cy="6" r="2.1" />
      <circle cx="5.6" cy="14" r="2.1" />
      <path d="m7.4 7.2 9.1 6.3M7.4 12.8l3.2-2.2M13.4 8.6l3.1-2.1" />
    </>
  ),
  send: (
    <>
      <path d="M16.6 3.4 9.2 10.8" />
      <path d="M16.6 3.4 12 16.2a.5.5 0 0 1-.9.1l-1.9-5.5-5.5-1.9a.5.5 0 0 1 .1-.9Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="4.6" width="13" height="12" rx="2.6" />
      <path d="M3.5 8.6h13M7 3v3M13 3v3" />
      <circle cx="7.3" cy="12.2" r=".8" fill="currentColor" stroke="none" />
      <circle cx="10" cy="12.2" r=".8" fill="currentColor" stroke="none" />
    </>
  ),
  palette: (
    <>
      <circle cx="7.4" cy="7.6" r="3.6" />
      <circle cx="12.6" cy="7.6" r="3.6" />
      <circle cx="10" cy="12.2" r="3.6" />
    </>
  ),
  storage: (
    <>
      <ellipse cx="10" cy="5.6" rx="6" ry="2.4" />
      <path d="M4 5.6v8.8c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V5.6" />
      <path d="M4 10c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4" />
    </>
  ),
  dictionary: (
    <>
      <path d="M4.2 5.4a2 2 0 0 1 2-2h7.6a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H6.2a2 2 0 0 1-2-2Z" />
      <path d="m7.6 11.8 2.4-5.6 2.4 5.6M8.5 9.9h3" />
      <path d="M7.4 14.2h5.2" />
    </>
  ),
  share: (
    <>
      <circle cx="5.2" cy="10" r="2.2" />
      <circle cx="14.6" cy="5" r="2.2" />
      <circle cx="14.6" cy="15" r="2.2" />
      <path d="m7.2 9 5.4-2.9M7.2 11l5.4 2.9" />
    </>
  ),
  zap: (
    <path d="M10.8 3.2 4.9 11a.5.5 0 0 0 .4.8h4l-.5 5 5.9-7.8a.5.5 0 0 0-.4-.8h-4Z" />
  ),
};

export default function StudioNavIcon({
  icon,
  className,
}: {
  icon: StudioIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {glyphs[icon]}
    </svg>
  );
}
