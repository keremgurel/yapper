import { NAMED_COLORS } from "./named-colors";

export const MAX_BRAND_COLORS = 8;

/** Exact CSS names or opaque hex colors; never guess a creator's shade. */
export function normalizeBrandColor(value: string): string | null {
  const color = value.trim();
  if (/^#[\da-f]{6}$/i.test(color)) return color.toUpperCase();
  if (/^#[\da-f]{3}$/i.test(color))
    return `#${color
      .slice(1)
      .split("")
      .map((digit) => digit + digit)
      .join("")}`.toUpperCase();
  const name = color.toLowerCase().replace(/[ -]/g, "");
  return Object.hasOwn(NAMED_COLORS, name) ? NAMED_COLORS[name] : null;
}

/** All-or-nothing validation prevents a malformed palette from clearing it. */
export function parseBrandColors(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_BRAND_COLORS) return null;
  const colors: string[] = [];
  for (const entry of value) {
    const color = typeof entry === "string" ? normalizeBrandColor(entry) : null;
    if (!color) return null;
    if (!colors.includes(color)) colors.push(color);
  }
  return colors;
}

export function nextBrandColor(colors: readonly string[]): string | null {
  if (colors.length >= MAX_BRAND_COLORS) return null;
  return (
    [
      "#FF7A21",
      "#151515",
      "#FFFFFF",
      "#FFD93D",
      "#3B9DFF",
      "#8B5CF6",
      "#10B981",
      "#EC4899",
      "#64748B",
    ].find((color) => !colors.includes(color)) ?? null
  );
}
