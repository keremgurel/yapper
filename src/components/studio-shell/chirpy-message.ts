export type ChirpyAuthor = "you" | "chirpy";

/** A question Chirpy asks before a change it cannot undo or one that keeps
 * running, answered with the row's buttons or a typed yes or no. */
export interface ChirpyConfirmation {
  executionID: string;
  question: string;
  confirmLabel: string;
  cancelLabel: string;
  /** How to answer in words, for the Mac's thread, which has no buttons. */
  typedHint: string;
  /** `expired` once the creator sent something else instead of answering. */
  state: "open" | "working" | "confirmed" | "canceled" | "expired";
}

/** One turn in the Chirpy panel's conversation. */
export interface ChirpyMessage {
  id: number;
  author: ChirpyAuthor;
  text: string;
  notes?: string[];
  tone?: "done" | "trouble";
  confirm?: ChirpyConfirmation;
}

/** The thread with every unanswered question marked expired, so a later
 * typed yes or no can only answer a question asked after it. The same array
 * when nothing was waiting. */
export function expireOpenConfirmations(
  messages: ChirpyMessage[],
): ChirpyMessage[] {
  if (!messages.some((message) => message.confirm?.state === "open"))
    return messages;
  return messages.map((message) =>
    message.confirm?.state === "open"
      ? { ...message, confirm: { ...message.confirm, state: "expired" } }
      : message,
  );
}
