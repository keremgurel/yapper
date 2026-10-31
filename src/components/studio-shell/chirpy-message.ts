import type { BlockSuggestion } from "@/lib/brain/client";

export type ChirpyAuthor = "you" | "chirpy";

/** A question Chirpy asks before a change it cannot undo, answered with the
 * row's buttons or a typed yes or no. */
export interface ChirpyConfirmation {
  executionID: string;
  question: string;
  confirmLabel: string;
  state: "open" | "working" | "confirmed" | "canceled";
}

/** One turn in the Chirpy panel's conversation. */
export interface ChirpyMessage {
  id: number;
  author: ChirpyAuthor;
  text: string;
  notes?: string[];
  suggestions?: BlockSuggestion[];
  brandColors?: string[];
  tone?: "done" | "trouble";
  confirm?: ChirpyConfirmation;
}
