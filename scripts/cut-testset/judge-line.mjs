/**
 * Judges one scripted line of one run: was exactly one good delivery of it
 * kept, and nothing else? Scored per line instead of per word, because a
 * transcriber's word edges drift into pauses, and because keeping the first
 * of two identical deliveries is as good as keeping the last.
 */

const KEPT = 0.8;
const DROPPED = 0.2;

/** How much of a segment's transcribed words a run kept, 0 to 1. `null` when no word landed in it. */
const share = (segment) =>
  segment.words === 0 ? null : segment.kept / segment.words;

/**
 * `segments` are the line's planned pieces with `words` and `kept` counts.
 * Returns "ok", or the name of what went wrong.
 */
export function judgeLine(pattern, segments) {
  const complete = segments.filter((s) =>
    ["final", "earlier-take", "earlier-wording"].includes(s.kind),
  );
  const scraps = segments.filter((s) => !complete.includes(s));
  const keptComplete = complete.filter((s) => (share(s) ?? 0) >= KEPT);
  const tornComplete = complete.filter((s) => {
    const part = share(s);
    return part !== null && part > DROPPED && part < KEPT;
  });
  const keptScraps = scraps.filter((s) => (share(s) ?? 0) > DROPPED);

  if (pattern === "emphasis") {
    // The whole line is one delivery that repeats itself on purpose.
    return (share(segments[0]) ?? 0) >= 0.95 ? "ok" : "cut a deliberate repeat";
  }
  if (keptScraps.length > 0) return "left a false start or aside in";
  if (keptComplete.length === 0)
    return tornComplete.length > 0
      ? "cut into a good line"
      : "dropped the line";
  if (keptComplete.length + tornComplete.length > 1) return "left a retake in";
  if (pattern === "reworded" && keptComplete[0].kind !== "final")
    return "kept the weaker wording";
  return "ok";
}
