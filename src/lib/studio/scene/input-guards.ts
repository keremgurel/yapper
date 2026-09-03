/**
 * The small checks every overlay route input goes through before a value is
 * interpolated into a prompt. Strict on purpose: a string that is too long or
 * a number that is not finite fails the whole request rather than being
 * trimmed, mirroring `overlay-input.ts`.
 */

export type Raw = Record<string, unknown>;

export const record = (value: unknown): Raw | null =>
  value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : null;

export const finiteBetween = (
  value: unknown,
  min: number,
  max: number,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

/** A non-empty string no longer than `max`, or null. */
export function requiredString(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() && value.length <= max
    ? value
    : null;
}

/**
 * A string no longer than `max`, `undefined` when absent, and `null` when
 * present but wrong: the three outcomes a parser has to tell apart.
 */
export function optionalString(
  value: unknown,
  max: number,
): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && value.length <= max ? value : null;
}

/** `undefined` when absent, the number when in range, null otherwise. */
export function optionalNumber(
  value: unknown,
  min: number,
  max: number,
): number | undefined | null {
  if (value === undefined) return undefined;
  return finiteBetween(value, min, max) ? value : null;
}

export function optionalBoolean(value: unknown): boolean | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "boolean" ? value : null;
}

/** An array of at most `max` entries, or null. Absent is an empty array. */
export function boundedArray(value: unknown, max: number): unknown[] | null {
  if (value === undefined) return [];
  return Array.isArray(value) && value.length <= max ? value : null;
}
