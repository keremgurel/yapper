import { newCaptionId, type Caption } from "@/lib/studio/types";

/**
 * Merge the captions named in `ids` into one spanning their full source range,
 * their text joined in temporal (source) order. Fewer than two of them actually
 * present is a no-op, returned BY REFERENCE so a merge with nothing real to
 * combine records nothing in history. Timing stays anchored in source time, so
 * the merged line keeps matching the speech, and the merged caption inherits the
 * earliest one's style. Blank pieces are dropped from the joined text.
 */
export function mergeCaptionsById(
  captions: Caption[],
  ids: Set<string>,
): Caption[] {
  const targets = captions
    .filter((c) => ids.has(c.id))
    .sort((a, b) => a.sourceStart - b.sourceStart);
  if (targets.length < 2) return captions;
  const merged: Caption = {
    ...targets[0],
    id: newCaptionId(),
    sourceStart: Math.min(...targets.map((c) => c.sourceStart)),
    sourceEnd: Math.max(...targets.map((c) => c.sourceEnd)),
    text: targets
      .map((c) => c.text.trim())
      .filter(Boolean)
      .join(" "),
  };
  return [...captions.filter((c) => !ids.has(c.id)), merged].sort(
    (a, b) => a.sourceStart - b.sourceStart,
  );
}
