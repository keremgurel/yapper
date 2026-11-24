/** Average glyph width of Inter 700 at -0.05em tracking, as a share of the font size. */
const AVERAGE_GLYPH_EM = 0.52;

/**
 * The largest size, up to `base`, at which `title` fits `maxWidth` on one
 * line. An estimate from the character count, good enough to keep a longer
 * series title inside the box.
 */
export function fitTitleSize(
  title: string,
  maxWidth: number,
  base: number,
  floor = 56,
): number {
  const fits = maxWidth / (Math.max(1, title.length) * AVERAGE_GLYPH_EM);
  return Math.round(Math.max(floor, Math.min(base, fits)));
}
