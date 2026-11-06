import type { StudioTurnInput } from "./wire";

const squeeze = (text: string) => text.replace(/\s+/g, " ").trim();

/** The creator's latest message in the turn, or "" on a confirmation. */
export function lastSaid(
  messages: StudioTurnInput["messages"] | undefined,
): string {
  return (
    messages?.findLast((message) => message.role === "user")?.content ?? ""
  );
}

/**
 * Whether `text` appears word for word in the creator's latest message,
 * ignoring runs of whitespace. Actions that store text as the creator's own
 * words check it here rather than trusting the model's arguments, so a
 * rewrite or an instruction hidden in a title cannot pass as a paste.
 */
export function saidVerbatim(
  text: string,
  messages: StudioTurnInput["messages"] | undefined,
): boolean {
  const words = squeeze(text);
  return words.length > 0 && squeeze(lastSaid(messages)).includes(words);
}
