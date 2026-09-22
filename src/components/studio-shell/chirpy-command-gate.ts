/** Longest message the typed-command matchers are allowed to look at. */
export const COMMAND_MAX_LENGTH = 240;

/**
 * Whether a message is short enough to be a typed command like "show my brand
 * kit". A pasted transcript or a multi-paragraph note can contain "change ...
 * voice ... to" by accident, and the command matchers would then rewrite the
 * Brain with a stray sentence. Anything long or multi-line goes to the model
 * as conversation instead.
 */
export function looksLikeCommand(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length <= COMMAND_MAX_LENGTH && !trimmed.includes("\n");
}
