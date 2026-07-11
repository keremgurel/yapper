import { clipIndexAtSource } from "@/lib/studio/clips";
import type { Clip, Word } from "@/lib/studio/types";

/** One thing the model asked for: this media, over these words. */
export interface Placement {
  /** The media's file name, as it appears in the library. */
  file: string;
  /** Words copied from the transcript, marking where the overlay belongs. */
  quote: string;
  /** Why, in one short line. Shown to the user, never acted on. */
  reason?: string;
}

/** A placement that has been found in the transcript, in SOURCE seconds. */
export interface PlacedSpan {
  file: string;
  reason?: string;
  sourceStart: number;
  sourceEnd: number;
}

/**
 * Pull the placements out of a model's reply, which may be fenced, chatty, or
 * nonsense. Anything that isn't a file name and a quote is dropped here rather
 * than trusted downstream.
 */
export function parsePlacements(reply: string): Placement[] {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: { placements?: unknown };
  try {
    parsed = JSON.parse(reply.slice(start, end + 1)) as {
      placements?: unknown;
    };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.placements)) return [];
  return parsed.placements.flatMap((p) => {
    if (typeof p !== "object" || p === null) return [];
    const { file, quote, reason } = p as Record<string, unknown>;
    if (typeof file !== "string" || typeof quote !== "string") return [];
    return [
      { file, quote, reason: typeof reason === "string" ? reason : undefined },
    ];
  });
}

/**
 * The words that survive the current edit.
 *
 * A transcript keeps every take the speaker made, including the ones the editor
 * has since cut. Offering those to the model is how you get a cutaway quoted
 * from a sentence that is no longer in the video, which then maps onto a cut
 * point and lands nowhere. It only ever sees what a viewer would hear.
 */
export function keptWords(words: Word[], clips: Clip[]): Word[] {
  return words.filter(
    (w) => clipIndexAtSource(clips, (w.start + w.end) / 2) >= 0,
  );
}

/** The shortest overlay worth placing. A quote of one short word is not a shot. */
export const MIN_SPAN_SEC = 0.4;

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9']/g, "");
}

/**
 * Where a quoted phrase sits in the transcript, as an inclusive word-index
 * range, or null when it isn't really there.
 *
 * The model is asked to copy the speaker's words verbatim, and mostly does, but
 * it drops a filler word or fixes a contraction often enough that an exact match
 * alone would throw away good placements. So: exact run of tokens first, then
 * the best same-length window, accepted only if most of its tokens agree.
 *
 * Never seconds and never indices. Asking a language model to count either is
 * asking for an off-by-one that lands a cutaway over the wrong sentence.
 */
export function findQuoteSpan(
  words: Word[],
  quote: string,
): { start: number; end: number } | null {
  // Punctuation-only tokens can't be matched against, but they can be spanned.
  const src: { token: string; index: number }[] = [];
  words.forEach((w, index) => {
    const token = norm(w.text);
    if (token) src.push({ token, index });
  });
  const wanted = quote
    .split(/\s+/)
    .map(norm)
    .filter((t) => t.length > 0);

  if (wanted.length === 0 || src.length < wanted.length) return null;

  const span = (i: number) => ({
    start: src[i].index,
    end: src[i + wanted.length - 1].index,
  });

  let best: { at: number; hits: number } | null = null;
  for (let i = 0; i + wanted.length <= src.length; i++) {
    let hits = 0;
    for (let k = 0; k < wanted.length; k++) {
      if (src[i + k].token === wanted[k]) hits++;
    }
    if (hits === wanted.length) return span(i);
    if (!best || hits > best.hits) best = { at: i, hits };
  }
  if (!best || best.hits < Math.ceil(wanted.length * 0.6)) return null;
  return span(best.at);
}

/**
 * Turn the model's placements into spans of source time, dropping every one it
 * made up: an unknown file, a quote that isn't in the transcript, a span too
 * short to see. Nothing reaches the timeline that the transcript doesn't back.
 */
export function placementsToSpans(
  words: Word[],
  placements: Placement[],
  knownFiles: string[],
): PlacedSpan[] {
  const known = new Set(knownFiles);
  const out: PlacedSpan[] = [];
  for (const p of placements) {
    if (!known.has(p.file)) continue;
    const span = findQuoteSpan(words, p.quote ?? "");
    if (!span) continue;
    const sourceStart = words[span.start].start;
    const sourceEnd = words[span.end].end;
    if (sourceEnd - sourceStart < MIN_SPAN_SEC) continue;
    out.push({ file: p.file, reason: p.reason, sourceStart, sourceEnd });
  }
  return out;
}
