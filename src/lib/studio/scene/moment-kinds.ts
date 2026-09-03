/** What a moment's visual is, by shape. The designer composes by kind. */
export const MOMENT_KINDS = [
  "counter",
  "chart",
  "comparison",
  "list",
  "diagram",
  "typography",
  "map",
  "illustration",
  "other",
] as const;

export type MomentKind = (typeof MOMENT_KINDS)[number];

export function isMomentKind(value: unknown): value is MomentKind {
  return (
    typeof value === "string" &&
    (MOMENT_KINDS as readonly string[]).includes(value)
  );
}
