import type { StudioSource } from "@/lib/studio/types";

/** A user-selectable output resolution. `shortSide` undefined = source native. */
export interface ResolutionChoice {
  id: string;
  label: string;
  /** Target for the frame's shorter side; undefined keeps native. */
  shortSide?: number;
  /** Short hint shown under the label (e.g. "1080 x 1920"). */
  hint: string;
}

// Standard short-side targets, largest first. Only offered when the source is
// actually bigger, so we never present an option that would upscale.
const STEPS = [
  { id: "1080p", label: "1080p", shortSide: 1080 },
  { id: "720p", label: "720p", shortSide: 720 },
] as const;

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);

/** Long side for a given short-side target, preserving the source aspect. */
function longFor(source: StudioSource, shortSide: number): number {
  const w = source.width || 1080;
  const h = source.height || 1920;
  const shorter = Math.min(w, h);
  const longer = Math.max(w, h);
  return even((longer / shorter) * shortSide);
}

/**
 * Resolution options for the export menu: "Original" at native size, plus any
 * standard step smaller than the source (never an upscale). Hints spell out the
 * exact pixel size so the choice is concrete, like a camera's quality picker.
 */
export function resolutionChoices(source: StudioSource): ResolutionChoice[] {
  const w = source.width || 1080;
  const h = source.height || 1920;
  const shorter = Math.min(w, h);
  const portrait = h >= w;
  const dims = (short: number, long: number) =>
    portrait ? `${short} x ${long}` : `${long} x ${short}`;

  const choices: ResolutionChoice[] = [
    { id: "original", label: "Original", hint: dims(shorter, Math.max(w, h)) },
  ];
  for (const step of STEPS) {
    if (shorter > step.shortSide) {
      choices.push({
        id: step.id,
        label: step.label,
        shortSide: step.shortSide,
        hint: dims(step.shortSide, longFor(source, step.shortSide)),
      });
    }
  }
  return choices;
}
