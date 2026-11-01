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
  state: "open" | "working" | "confirmed" | "canceled";
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
