export type StudioDecision = "confirm" | "cancel";

const YES =
  /^(?:yes|yep|yeah|yup|sure|ok(?:ay)?|confirm(?:ed)?|do it|go ahead|delete (?:it|them)|please do)[.! ]*$/i;
const NO =
  /^(?:no|nope|cancel|stop|don[’']?t|keep (?:it|them)|never ?mind)[.! ]*$/i;

/** A bare yes or no answering a confirmation question, as typed in the Mac's
 * thread, which has no buttons. Anything longer is a new request. */
export function typedDecision(text: string): StudioDecision | null {
  const trimmed = text.trim();
  if (YES.test(trimmed)) return "confirm";
  if (NO.test(trimmed)) return "cancel";
  return null;
}
