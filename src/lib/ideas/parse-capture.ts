import type { IdeaInput } from "@/lib/ideas/types";

/**
 * Turn one free-form capture (typed or dictated) into an idea input. A single
 * box handles all three kinds: a bare link becomes an inspiration, words become
 * an original idea, and a link with words around it becomes a semi-original.
 * The URL is pulled out; whatever remains is the creator's own words.
 */
export function parseCapture(text: string): IdeaInput {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  const transcript = (url ? text.replace(url, " ") : text).trim();
  return {
    transcript: transcript || undefined,
    url: url || undefined,
  };
}
