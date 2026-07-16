import { newCaptionId, type Caption } from "@/lib/studio/types";

const words = (c: Caption): string[] => c.text.split(/\s+/).filter(Boolean);

/** The two captions produced by cutting `c` after word `k`, with the boundary
 * placed at source time `atSrc`: the head keeps words [0, k) and ends at atSrc,
 * the tail keeps the rest and starts there. Both keep every other field of `c`. */
function cut(c: Caption, k: number, atSrc: number): [Caption, Caption] {
  const parts = words(c);
  return [
    {
      ...c,
      id: newCaptionId(),
      sourceEnd: atSrc,
      text: parts.slice(0, k).join(" "),
    },
    {
      ...c,
      id: newCaptionId(),
      sourceStart: atSrc,
      text: parts.slice(k).join(" "),
    },
  ];
}

/**
 * Split a caption into two at source time `atSrc`, apportioning its words by
 * where atSrc falls in its span. Returns the caption unchanged when it holds
 * fewer than two words (nothing to divide, so no empty ghost caption) or when
 * atSrc sits within 0.05s of either edge (too close to split cleanly). Pure
 * apart from the new ids it mints.
 */
export function splitCaptionAtTime(c: Caption, atSrc: number): Caption[] {
  const parts = words(c);
  if (parts.length < 2) return [c];
  if (atSrc <= c.sourceStart + 0.05 || atSrc >= c.sourceEnd - 0.05) return [c];
  const frac = (atSrc - c.sourceStart) / (c.sourceEnd - c.sourceStart);
  const k = Math.max(
    1,
    Math.min(parts.length - 1, Math.round(frac * parts.length)),
  );
  return cut(c, k, atSrc);
}

/**
 * Split a caption after `wordsBefore` words (Enter in the editor). The source
 * boundary is placed by word count, so the two halves' timing stays proportional
 * to their text. Returns the caption unchanged when it holds fewer than two
 * words. Pure apart from the new ids it mints.
 */
export function splitCaptionAtWordIndex(
  c: Caption,
  wordsBefore: number,
): Caption[] {
  const parts = words(c);
  if (parts.length < 2) return [c];
  const k = Math.max(1, Math.min(parts.length - 1, wordsBefore));
  const atSrc =
    c.sourceStart + (k / parts.length) * (c.sourceEnd - c.sourceStart);
  return cut(c, k, atSrc);
}
