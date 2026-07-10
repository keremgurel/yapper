/**
 * Do two spans touch? Used by the marquee to decide what its box has caught,
 * both horizontally (a clip's seconds against the box's) and vertically (a
 * track row's pixels against the box's).
 *
 * Inclusive at both ends: a box drawn exactly onto a clip's edge catches it,
 * which is what you expect when you drag a box up against something.
 */
export function spansOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aEnd >= bStart && aStart <= bEnd;
}
