/**
 * How much of each Essentials field the AI reads. Past this, the field is cut
 * on a word boundary before it reaches a prompt, so anything longer is text
 * the creator wrote that no model ever sees.
 *
 * Shared by the compiler, which enforces it, and Brain setup, which writes to
 * it. The native Essentials card mirrors these numbers in
 * `BrainProjectField.readLimit`; change both together.
 */
export const ESSENTIAL_FIELD_CAPS = {
  name: 80,
  whatIMake: 320,
  audience: 320,
  voice: 240,
  scriptingPatterns: 400,
  offers: 200,
  doNots: 200,
} as const;

export type EssentialFieldKey = keyof typeof ESSENTIAL_FIELD_CAPS;
