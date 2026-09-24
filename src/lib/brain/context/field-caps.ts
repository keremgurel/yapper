/**
 * How much of each Essentials field the AI reads. Past this, the field is cut
 * on a word boundary before it reaches a prompt, so anything longer is text
 * the creator wrote that no model ever sees.
 *
 * Shared by the compiler, which enforces it, and Brain setup, which writes to
 * it. Room for a short paragraph each: enough to say something specific,
 * short enough that the six together stay under a thousand tokens. The native Essentials card mirrors these numbers in
 * `BrainProjectField.readLimit`; change both together.
 */
export const ESSENTIAL_FIELD_CAPS = {
  name: 80,
  whatIMake: 480,
  audience: 480,
  voice: 480,
  scriptingPatterns: 720,
  offers: 400,
  doNots: 480,
} as const;

export type EssentialFieldKey = keyof typeof ESSENTIAL_FIELD_CAPS;
