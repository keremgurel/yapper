import { undash } from "@/lib/text/undash";

/** The brainstorm writes markdown for its own chat; Chirpy's thread shows
 * plain text, so bold markers and heading marks go, and so do dashes. */
export function plainReply(text: string): string {
  return undash(
    text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/^#{1,6}\s+/gm, ""),
  ).trim();
}
