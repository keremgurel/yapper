import { clipIndexAtSource } from "@/lib/studio/clips";
import type { Clip, Word } from "@/lib/studio/types";

/**
 * Where the model asked for an overlay to sit, as fractions of the frame from
 * its top left.
 *
 * Height is deliberately absent: it is worked out from the width and the
 * media's own shape, so nothing the model returns can squash a picture.
 */
export interface ProposedBox {
  x: number;
  y: number;
  width: number;
}

/** One thing the model asked for: this media, over these words. */
export interface Placement {
  /** The media's file name, as it appears in the library. */
  file: string;
  /** Words copied from the transcript, marking where the overlay belongs. */
  quote: string;
  /** Why, in one short line. Shown to the user, never acted on. */
  reason?: string;
  /**
   * Where it asked for the overlay, or absent when it did not say. A proposal,
   * not an instruction: the client repairs it against the faces it found in
   * the footage before anything is placed.
   */
  box?: ProposedBox;
  /**
   * The word inside the quote the media should appear on. Without one it
   * covers the whole quote, which is how placements worked before cues.
   */
  cue?: string;
  /** A label shared by media that belongs in one row on screen. */
  group?: string;
  /** An effect from the client's library to play as it appears. */
  sound?: string;
}

/** A sound that belongs to no media. */
export interface SoundRequest {
  /** An id from the client's library. Never a file name. */
  effect: string;
  /** The sentence it lands in, when it belongs to a moment of speech. */
  quote?: string;
  /** The word inside that sentence it lands on. */
  cue?: string;
  /** `cut` when it belongs at every cut rather than at a word. */
  every?: string;
  /**
   * A time in seconds, and only ever one the user typed into their own
   * instruction. The client checks that they really did before acting on it,
   * because a time the model worked out for itself is a time it counted.
   */
  at?: number;
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Pull the standalone sounds out of a reply.
 *
 * The library is fixed and travels with the question, so an effect the client
 * does not have is dropped here rather than sent back for it to puzzle over.
 * `known` empty means the client sent no library, and then it wants no sounds.
 */
export function parseSounds(reply: string, known: string[]): SoundRequest[] {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start || known.length === 0) return [];
  let parsed: { sounds?: unknown };
  try {
    parsed = JSON.parse(reply.slice(start, end + 1)) as { sounds?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.sounds)) return [];
  const library = new Set(known);
  return parsed.sounds.flatMap((s) => {
    if (typeof s !== "object" || s === null) return [];
    const entry = s as Record<string, unknown>;
    const effect = text(entry.effect);
    if (!effect || !library.has(effect)) return [];
    const at =
      typeof entry.at === "number" && Number.isFinite(entry.at) && entry.at >= 0
        ? entry.at
        : undefined;
    return [
      {
        effect,
        quote: text(entry.quote),
        cue: text(entry.cue),
        every: text(entry.every),
        at,
      },
    ];
  });
}

/** Words to put on the screen, over a stretch of speech. */
export interface TextRequest {
  /** What it says. Short: this is a label, not a caption. */
  text: string;
  /** The sentence it belongs to, copied from the transcript. */
  quote: string;
  /** The word inside that sentence it appears on. */
  cue?: string;
  /**
   * How long it stays up. `quote` to the end of its own sentence, which is the
   * default and what a label pinned to one phrase wants; `next` until the text
   * after it arrives; `end` for the rest of the video; or words copied from
   * later in the transcript to hold it until those are spoken.
   *
   * The last of those is what "hold them all until I finish the list" means,
   * and there is no way to say it in seconds without counting the transcript,
   * which is exactly what a model must not be asked to do.
   */
  until?: string;
}

/**
 * Pull the on-screen text out of a reply.
 *
 * Held to the same rule as everything else here: the words it goes over must be
 * quoted from the transcript, so the moment is something the client can find
 * rather than something the model timed.
 */
export function parseTexts(reply: string): TextRequest[] {
  const start = reply.indexOf("{");
  const end = reply.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  let parsed: { texts?: unknown };
  try {
    parsed = JSON.parse(reply.slice(start, end + 1)) as { texts?: unknown };
  } catch {
    return [];
  }
  if (!Array.isArray(parsed.texts)) return [];
  return parsed.texts.flatMap((t) => {
    if (typeof t !== "object" || t === null) return [];
    const entry = t as Record<string, unknown>;
    const body = text(entry.text);
    const quote = text(entry.quote);
    if (!body || !quote) return [];
    return [
      {
        text: body,
        quote,
        cue: text(entry.cue),
        until: text(entry.until),
      },
    ];
  });
}

/**
 * The furthest outside the frame a proposal may reach before it stops being a
 * box that slipped and starts being a number that means nothing.
 */
const BOX_BOUND = 1.5;

function usable(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return value >= -0.5 && value <= BOX_BOUND ? value : undefined;
}

/**
 * The box in a placement, or undefined when the model left it out or answered
 * with something that is not a fraction of a frame.
 *
 * A bad box never costs a placement its words: those are the hard part, and a
 * missing box just means the client starts from its own default card.
 */
export function parseBox(
  entry: Record<string, unknown>,
): ProposedBox | undefined {
  const width = usable(entry.width);
  const x = usable(entry.x);
  const y = usable(entry.y);
  if (width === undefined || width <= 0 || x === undefined || y === undefined) {
    return undefined;
  }
  return { x, y, width };
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
    const entry = p as Record<string, unknown>;
    const { file, quote, reason } = entry;
    if (typeof file !== "string" || typeof quote !== "string") return [];
    return [
      {
        file,
        quote,
        reason: typeof reason === "string" ? reason : undefined,
        box: parseBox(entry),
        cue: text(entry.cue),
        group: text(entry.group),
        sound: text(entry.sound),
      },
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
