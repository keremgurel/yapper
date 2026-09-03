/** Colours a scene may name: a hex value or a brand token. */

export const SCENE_BRAND_TOKENS = [
  "brand.primary",
  "brand.secondary",
  "brand.accent",
  "brand.ink",
  "brand.surface",
  "brand.muted",
] as const;

export type SceneBrandToken = (typeof SCENE_BRAND_TOKENS)[number];

/** The palette a scene's tokens resolve against, stored with the asset. */
export type ScenePalette = Record<
  "primary" | "secondary" | "accent" | "ink" | "surface" | "muted",
  string
>;

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const SHORT_HEX = /^#[0-9a-f]{3}$/i;
const NAMED: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
  transparent: "#00000000",
};

/**
 * The colour as the renderer will read it: upper-case hex, or a token. `null`
 * when the value is not a colour at all.
 */
export function normalizeSceneColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if ((SCENE_BRAND_TOKENS as readonly string[]).includes(trimmed)) {
    return trimmed;
  }
  const named = NAMED[trimmed.toLowerCase()];
  if (named) return named;
  if (HEX.test(trimmed)) return trimmed.toUpperCase();
  if (SHORT_HEX.test(trimmed)) {
    const [r, g, b] = trimmed.slice(1).split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return null;
}

export function isSceneBrandToken(value: string): value is SceneBrandToken {
  return (SCENE_BRAND_TOKENS as readonly string[]).includes(value);
}

function channel(hex: string, index: number): number {
  return parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16) / 255;
}

/** WCAG relative luminance of an opaque hex colour. */
export function luminance(hex: string): number {
  const linear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return (
    0.2126 * linear(channel(hex, 0)) +
    0.7152 * linear(channel(hex, 1)) +
    0.0722 * linear(channel(hex, 2))
  );
}

/**
 * The palette for a brand kit, or the neutral house palette for none.
 *
 * The first colour is primary, by the brand kit's own convention. Surface and
 * ink are chosen so text on a card reads, whichever way round the brand is.
 */
export function paletteFor(colors: readonly string[]): ScenePalette {
  const valid = colors
    .map(normalizeSceneColor)
    .filter((c): c is string => c !== null && HEX.test(c))
    .map((c) => c.slice(0, 7));
  const primary = valid[0] ?? "#F96F4B";
  const secondary =
    valid[1] ?? (luminance(primary) > 0.4 ? "#1B181C" : "#FFFFFF");
  const accent = valid[2] ?? primary;
  const surface = "#FFFFFF";
  const ink = "#1B181C";
  const muted = "#8A858B";
  return { primary, secondary, accent, ink, surface, muted };
}
