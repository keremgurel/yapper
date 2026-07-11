import type { StudioSource } from "@/lib/studio/types";

/**
 * The project's frame shape. This — not the bottom track — decides the preview
 * stage and the exported frame. "Original" follows the project's own recording;
 * every other preset is an explicit user choice that survives deleting, hiding,
 * or replacing any track.
 */
export type AspectId = "source" | "9:16" | "4:5" | "1:1" | "16:9";

export interface AspectPreset {
  id: AspectId;
  label: string;
  hint: string;
  /** width / height. null = follow the project's source media. */
  ratio: number | null;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  { id: "source", label: "Original", hint: "Match the recording", ratio: null },
  { id: "9:16", label: "9:16", hint: "Reels, Shorts, TikTok", ratio: 9 / 16 },
  { id: "4:5", label: "4:5", hint: "Instagram feed", ratio: 4 / 5 },
  { id: "1:1", label: "1:1", hint: "Square", ratio: 1 },
  { id: "16:9", label: "16:9", hint: "YouTube, landscape", ratio: 16 / 9 },
];

export const DEFAULT_ASPECT_ID: AspectId = "source";

/** Used when "Original" is picked but nothing has reported dimensions yet. */
const FALLBACK_RATIO = 9 / 16;

/** Frame width / height for the chosen preset. */
export function resolveAspect(
  id: AspectId,
  source: StudioSource | null,
): number {
  const preset = ASPECT_PRESETS.find((p) => p.id === id);
  if (preset?.ratio != null) return preset.ratio;
  if (source?.width && source?.height) return source.width / source.height;
  return FALLBACK_RATIO;
}
