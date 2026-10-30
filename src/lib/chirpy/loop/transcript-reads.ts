import { record } from "../protocol";

/**
 * Reads over the transcript the Mac app sends: runs of numbered tokens per
 * recording, like `0:It's 1:been [2:um] (pause 4.120-4.900) 3:one`, where
 * brackets mark what is cut. Results keep that syntax so the model reads the
 * same notation it edits with.
 */
interface Token {
  mediaID: string;
  raw: string;
  /** Word number, or for a pause the number of the word before it. */
  number: number;
  word?: string;
}

const TOKEN = /\[?\(?pause [\d.]+-[\d.]+\)?\]?|\S+/g;
const WORD = /^\[?(\d+):(.*?)\]?$/;
const PHRASE_CONTEXT_WORDS = 12;
const MAX_OCCURRENCES = 10;
const MAX_WORDS = 600;

function tokens(transcript: unknown): Token[] {
  if (!Array.isArray(transcript)) return [];
  const result: Token[] = [];
  let last = -1;
  for (const run of transcript) {
    if (!record(run) || typeof run.text !== "string") continue;
    const mediaID = String(run.mediaID ?? "");
    for (const raw of run.text.match(TOKEN) ?? []) {
      const word = WORD.exec(raw);
      if (word) {
        last = Number(word[1]);
        result.push({ mediaID, raw, number: last, word: word[2] });
      } else if (raw.includes("pause")) {
        result.push({ mediaID, raw, number: last });
      }
    }
  }
  return result;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "");
}

/** Group tokens back into per-recording runs. */
function runs(selected: Token[]) {
  const out: { mediaID: string; text: string }[] = [];
  for (const token of selected) {
    const run = out.at(-1);
    if (run?.mediaID === token.mediaID) run.text += ` ${token.raw}`;
    else out.push({ mediaID: token.mediaID, text: token.raw });
  }
  return out;
}

function range(all: Token[], from: number, to: number) {
  return runs(
    all.filter((token) =>
      token.word !== undefined
        ? token.number >= from && token.number <= to
        : token.number >= from && token.number < to,
    ),
  );
}

export function readTranscript(
  transcript: unknown,
  query: { fromWord?: number; toWord?: number; phrase?: string },
): unknown {
  const all = tokens(transcript);
  const words = all.filter((token) => token.word !== undefined);
  if (!words.length) return { error: "This project has no transcript." };
  const lastWord = words.at(-1)!.number;

  if (query.phrase?.trim()) {
    const wanted = query.phrase.split(/\s+/).map(normalize).filter(Boolean);
    const occurrences: unknown[] = [];
    for (let i = 0; i + wanted.length <= words.length; i++) {
      if (!wanted.every((w, k) => normalize(words[i + k].word!) === w))
        continue;
      const fromWord = words[i].number;
      const toWord = words[i + wanted.length - 1].number;
      occurrences.push({
        occurrence: occurrences.length + 1,
        fromWord,
        toWord,
        context: range(
          all,
          Math.max(0, fromWord - PHRASE_CONTEXT_WORDS),
          toWord + PHRASE_CONTEXT_WORDS,
        ),
      });
      if (occurrences.length === MAX_OCCURRENCES) break;
    }
    return { phrase: query.phrase, found: occurrences.length, occurrences };
  }

  const from = Math.max(0, Math.floor(query.fromWord ?? 0));
  const to = Math.min(
    lastWord,
    Math.floor(query.toWord ?? from + MAX_WORDS - 1),
    from + MAX_WORDS - 1,
  );
  return {
    words: lastWord + 1,
    fromWord: from,
    toWord: to,
    more: to < lastWord,
    runs: range(all, from, to),
  };
}
