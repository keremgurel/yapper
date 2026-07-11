import { nativeShortSide } from "@/lib/studio/export/dimensions";
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

/**
 * Resolution options for the export menu: "Original" at native detail, plus any
 * standard step smaller than the source (never an upscale). Hints spell out the
 * exact pixel size at the project's chosen frame ratio, so the choice is
 * concrete, like a camera's quality picker.
 */
export function resolutionChoices(
  source: StudioSource | null,
  aspect: number,
): ResolutionChoice[] {
  const shorter = nativeShortSide(source);
  const portrait = aspect < 1;
  const longFor = (short: number) =>
    even(portrait ? short / aspect : short * aspect);
  const dims = (short: number) =>
    portrait
      ? `${even(short)} x ${longFor(short)}`
      : `${longFor(short)} x ${even(short)}`;

  const choices: ResolutionChoice[] = [
    { id: "original", label: "Original", hint: dims(shorter) },
  ];
  for (const step of STEPS) {
    if (shorter > step.shortSide) {
      choices.push({
        id: step.id,
        label: step.label,
        shortSide: step.shortSide,
        hint: dims(step.shortSide),
      });
    }
  }
  return choices;
}
