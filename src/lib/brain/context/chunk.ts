/**
 * Splitting a pasted document into the slices the compiler selects from.
 *
 * A creator who pastes their competitor teardown, a research summary, or the
 * transcript of the video that worked wants all of it kept and none of it sent
 * whole. Chunks are the unit that makes that possible: the router picks the
 * document, then the two slices that mention what is being written are what
 * spend prompt budget.
 *
 * Boundaries follow the document rather than a character count wherever the
 * document offers one, because a slice that starts mid-argument reads as a
 * quote taken out of context, and that is exactly how a model will use it.
 */

export interface DocChunk {
  ord: number;
  /** The nearest heading above this slice, when the source had one. */
  heading: string;
  text: string;
  charCount: number;
}

const TARGET_CHARS = 800;
const MAX_CHARS = 1_500;
/** Below this, a document is one chunk and the whole thing is the slice. */
export const CHUNK_THRESHOLD = 1_500;
const HEADING_CAP = 80;
const MAX_CHUNKS = 400;

const HEADING = /^(#{1,6}\s+.+|[A-Z][^\n]{0,78}:)\s*$/;

function isHeading(line: string): boolean {
  return HEADING.test(line.trim());
}

function headingText(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/:$/, "")
    .slice(0, HEADING_CAP);
}

/** Last resort for a paragraph with no internal structure: cut on sentence
 * ends, and only mid-sentence if a single sentence is longer than the cap. */
function splitLong(text: string, max: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > max) {
      if (current) parts.push(current.trim());
      current = "";
      for (let at = 0; at < sentence.length; at += max) {
        parts.push(sentence.slice(at, at + max));
      }
      continue;
    }
    if (current.length + sentence.length + 1 > max) {
      parts.push(current.trim());
      current = sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

/**
 * Chunk a document. A short one comes back as a single chunk, which keeps the
 * caller from having to special-case the common paste.
 */
export function chunkDocument(input: string): DocChunk[] {
  const text = (input ?? "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  if (text.length <= CHUNK_THRESHOLD) {
    return [{ ord: 0, heading: "", text, charCount: text.length }];
  }

  const chunks: DocChunk[] = [];
  let heading = "";
  let buffer: string[] = [];
  let length = 0;

  const flush = () => {
    const body = buffer.join("\n\n").trim();
    buffer = [];
    length = 0;
    if (!body) return;
    for (const part of body.length > MAX_CHARS
      ? splitLong(body, MAX_CHARS)
      : [body]) {
      if (chunks.length >= MAX_CHUNKS) return;
      chunks.push({
        ord: chunks.length,
        heading,
        text: part,
        charCount: part.length,
      });
    }
  };

  // Paragraphs, so a blank line is always a legal place to cut.
  for (const paragraph of text.split(/\n{2,}/)) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    if (lines.length === 1 && isHeading(lines[0])) {
      // A heading owns what follows it, so the slice starts here.
      flush();
      heading = headingText(lines[0]);
      continue;
    }

    if (length + trimmed.length > TARGET_CHARS && buffer.length) flush();
    buffer.push(trimmed);
    length += trimmed.length + 2;
    if (length >= MAX_CHARS) flush();
  }
  flush();

  return chunks;
}
