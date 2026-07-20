import type { RawWord } from "@/lib/studio/transcribe-remote";

export const MAX_DICTIONARY_ENTRIES = 100;
export const MAX_DICTIONARY_TERM_LENGTH = 80;
export const MAX_DICTIONARY_ALIASES = 20;

export interface TranscriptionDictionaryEntry {
  id: string;
  term: string;
  aliases: string[];
}

export interface CaptionCorrection {
  heard: string;
  term: string;
}

/** Case/punctuation-insensitive key used for matching and uniqueness. */
export function dictionaryKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .slice(0, MAX_DICTIONARY_TERM_LENGTH);
}

export function cleanDictionaryValue(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_DICTIONARY_TERM_LENGTH);
}

export function cleanDictionaryAliases(values: string[]): string[] {
  const seen = new Set<string>();
  const aliases: string[] = [];
  for (const value of values) {
    const alias = cleanDictionaryValue(value);
    const key = dictionaryKey(alias);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    aliases.push(alias);
    if (aliases.length >= MAX_DICTIONARY_ALIASES) break;
  }
  return aliases;
}

/**
 * A conservative caption diff for the inline "remember this" affordance.
 * It only fires for a one-token substitution, never for rewrites, additions,
 * or punctuation-only edits where the user's intent would be ambiguous.
 */
export function findCaptionCorrection(
  before: string,
  after: string,
): CaptionCorrection | null {
  const from = before.trim().split(/\s+/).filter(Boolean);
  const to = after.trim().split(/\s+/).filter(Boolean);
  if (from.length === 0 || from.length !== to.length) return null;

  let correction: CaptionCorrection | null = null;
  for (let i = 0; i < from.length; i++) {
    if (dictionaryKey(from[i]) === dictionaryKey(to[i])) continue;
    if (correction) return null;
    const heard = cleanDictionaryValue(
      from[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
    );
    const term = cleanDictionaryValue(
      to[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""),
    );
    if (!dictionaryKey(heard) || !dictionaryKey(term)) return null;
    correction = { heard, term };
  }
  return correction;
}

const trailingPunctuation = (value: string) =>
  value.match(/[,.!?;:]+$/u)?.[0] ?? "";

interface Pattern {
  entry: TranscriptionDictionaryEntry;
  tokens: string[];
}

/**
 * Apply only user-approved spellings. Canonical terms are included as patterns
 * so a lowercase ASR result still receives the user's exact casing. Multi-word
 * aliases retain per-word timings when token counts match; otherwise they
 * collapse to the full acoustic range instead of inventing timestamps.
 */
export function applyTranscriptionDictionary(
  words: RawWord[],
  entries: TranscriptionDictionaryEntry[],
): RawWord[] {
  if (words.length === 0 || entries.length === 0) return words;

  const patterns: Pattern[] = [];
  for (const entry of entries) {
    for (const value of [entry.term, ...entry.aliases]) {
      const tokens = value.split(/\s+/).map(dictionaryKey).filter(Boolean);
      if (tokens.length > 0) patterns.push({ entry, tokens });
    }
  }
  patterns.sort((a, b) => b.tokens.length - a.tokens.length);

  const out: RawWord[] = [];
  for (let i = 0; i < words.length; ) {
    const match = patterns.find(({ tokens }) =>
      tokens.every(
        (token, offset) =>
          dictionaryKey(words[i + offset]?.text ?? "") === token,
      ),
    );
    if (!match) {
      out.push(words[i]);
      i += 1;
      continue;
    }

    const source = words.slice(i, i + match.tokens.length);
    const canonical = match.entry.term.split(/\s+/).filter(Boolean);
    if (canonical.length === source.length) {
      for (let j = 0; j < source.length; j++) {
        out.push({
          ...source[j],
          text:
            canonical[j] +
            (j === source.length - 1
              ? trailingPunctuation(source[j].text)
              : ""),
        });
      }
    } else {
      out.push({
        text:
          match.entry.term +
          trailingPunctuation(source[source.length - 1].text),
        start: source[0].start,
        end: source[source.length - 1].end,
      });
    }
    i += match.tokens.length;
  }
  return out;
}

/** Terms sent to the ASR, deduped and bounded for a safe request URL. */
export function dictionaryKeyterms(
  entries: TranscriptionDictionaryEntry[],
): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  let requestChars = 0;
  for (const entry of entries) {
    const term = cleanDictionaryValue(entry.term);
    const key = dictionaryKey(term);
    if (!key || seen.has(key)) continue;
    // Keep the query safely below common proxy URL limits. Every saved entry
    // still participates in deterministic alias correction after ASR.
    if (requestChars + term.length > 3_000) break;
    seen.add(key);
    terms.push(term);
    requestChars += term.length;
    if (terms.length >= 50) break;
  }
  return terms;
}
