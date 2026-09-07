import type { CanvasBlockInput } from "@/lib/content/canvas-actions";

const BULLET = /^\s*(?:[-*•·]|\d{1,2}[.)])\s+(.*\S)\s*$/;

/**
 * Turns something Chirpy said into a block for the page.
 *
 * An answer that reads as a list becomes bullets (numbered lines become
 * steps); anything else becomes a paragraph. The label comes from what was
 * asked, trimmed to a heading, so "what are the key points here?" lands as a
 * block called "Key points here".
 */
export function noteToBlock(note: string, asked: string): CanvasBlockInput {
  const lines = note
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const listed = lines.filter((line) => BULLET.test(line));
  const label = labelFor(asked);
  if (lines.length >= 2 && listed.length >= Math.ceil(lines.length * 0.6)) {
    const numbered = listed.every((line) => /^\s*\d{1,2}[.)]/.test(line));
    return {
      label,
      kind: numbered ? "steps" : "bullets",
      items: listed.map((line) => line.replace(BULLET, "$1")),
    };
  }
  return { label, kind: "paragraph", text: note.trim() };
}

/** A heading out of a question: the leading question words go, the rest is
 * capitalised and cut to a label's length. */
export function labelFor(asked: string): string {
  const stripped = asked
    .trim()
    .replace(/[?.!]+$/, "")
    .replace(
      /^(what are|what is|what's|whats|give me|list|show me|tell me|can you|could you|please|write|add|suggest)\s+(the\s+|some\s+|a\s+|an\s+)?/i,
      "",
    )
    .trim();
  const text = stripped || "Notes";
  const cut =
    text.length > 40 ? text.slice(0, 40).replace(/\s+\S*$/, "") : text;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}
