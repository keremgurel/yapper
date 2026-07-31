export type VisualFilterId =
  | "original"
  | "clean"
  | "warm"
  | "cool"
  | "punch"
  | "mono"
  | "fade";

export interface VisualFilter {
  id: VisualFilterId;
  strength: number;
}

export const DEFAULT_VISUAL_FILTER: VisualFilter = {
  id: "original",
  strength: 1,
};

export const VISUAL_FILTERS: Array<{
  id: VisualFilterId;
  name: string;
  hint: string;
}> = [
  { id: "original", name: "Original", hint: "No filter" },
  { id: "clean", name: "Clean", hint: "Bright and crisp" },
  { id: "warm", name: "Warm", hint: "Soft warmth" },
  { id: "cool", name: "Cool", hint: "Blue balance" },
  { id: "punch", name: "Punch", hint: "Bold contrast" },
  { id: "mono", name: "Mono", hint: "Black and white" },
  { id: "fade", name: "Fade", hint: "Soft film wash" },
];

const lerp = (from: number, to: number, amount: number) =>
  from + (to - from) * amount;

export function visualFilterCss(filter: VisualFilter): string {
  const strength = Math.max(0, Math.min(1, filter.strength));
  const target = {
    original: [1, 1, 1, 0, 0, 0],
    clean: [1.05, 1.08, 0.98, 0, 0, 0],
    warm: [1.03, 1.06, 1.12, 0.08, -4, 0],
    cool: [1.01, 1.06, 1.06, 0, 9, 0],
    punch: [1.01, 1.2, 1.22, 0, 0, 0],
    mono: [1.02, 1.14, 0.9, 0, 0, 1],
    fade: [1.06, 0.86, 0.82, 0.04, 0, 0],
  }[filter.id] ?? [1, 1, 1, 0, 0, 0];
  const [brightness, contrast, saturation, sepia, hue, grayscale] = target;
  return [
    `brightness(${lerp(1, brightness, strength)})`,
    `contrast(${lerp(1, contrast, strength)})`,
    `saturate(${lerp(1, saturation, strength)})`,
    `sepia(${lerp(0, sepia, strength)})`,
    `hue-rotate(${lerp(0, hue, strength)}deg)`,
    `grayscale(${lerp(0, grayscale, strength)})`,
  ].join(" ");
}
