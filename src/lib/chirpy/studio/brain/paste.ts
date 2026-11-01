import type { StudioTurnInput } from "../wire";

/** A request line ahead of the paste ("File this:"), dropped so a table's
 * header row is the first line the parser sees. */
const LEAD_IN = /^[^\n]{0,160}:\s*\n/;

/**
 * What the creator pasted: their most recent message of at least `minChars`,
 * read on the server so the model never copies it into arguments. A short
 * request line ending in a colon ahead of it is dropped.
 */
export function latestPaste(
  messages: StudioTurnInput["messages"] | undefined,
  minChars: number,
): string | null {
  const message = messages
    ?.filter((item) => item.role === "user")
    .findLast((item) => item.content.trim().length >= minChars);
  if (!message) return null;
  const text = message.content.trim();
  const body = LEAD_IN.test(text) ? text.replace(LEAD_IN, "") : text;
  return body.trim() || null;
}
