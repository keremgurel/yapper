import type { BlockSuggestion } from "@/lib/brain/client";

export type ChirpyAuthor = "you" | "chirpy";

/** One turn in the Chirpy panel's conversation. */
export interface ChirpyMessage {
  id: number;
  author: ChirpyAuthor;
  text: string;
  notes?: string[];
  suggestions?: BlockSuggestion[];
  brandColors?: string[];
  tone?: "done" | "trouble";
}
