/**
 * How much of an Essentials field the AI actually reads, counted the way the
 * compiler counts (`clamp` in `context/text.ts`): whitespace runs collapse to
 * one space and the ends are trimmed. The native Essentials card counts the
 * same way in `BrainFieldFit.length`.
 */
export function fieldLength(text: string): number {
  return (text ?? "").replace(/\s+/g, " ").trim().length;
}

/** How many characters run past the limit, or 0 when it all fits. */
export function charactersCut(text: string, limit: number): number {
  return Math.max(0, fieldLength(text) - limit);
}
