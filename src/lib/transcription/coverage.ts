import type { RawWord } from "@/lib/studio/transcription-dictionary";
import type { TimedAsrChunk } from "./chunks";

export type SpeechRange = [number, number];

/** Compare independent acoustic speech detections with ASR, never text gaps
 * with silence. Small timestamp errors are allowed; sustained missing speech
 * is not. This measures coverage, not spelling or recognition accuracy. */
export function uncoveredSpeech(
  words: RawWord[],
  speech: SpeechRange[],
): SpeechRange[] {
  const covered = words
    .map((word) => [word.start - 0.12, word.end + 0.12] as SpeechRange)
    .sort((a, b) => a[0] - b[0]);
  const missing: SpeechRange[] = [];
  for (const [start, end] of speech) {
    let cursor = start;
    for (const [left, right] of covered) {
      if (right <= cursor) continue;
      if (left >= end) break;
      if (left > cursor) missing.push([cursor, Math.min(left, end)]);
      cursor = Math.max(cursor, right);
      if (cursor >= end) break;
    }
    if (cursor < end) missing.push([cursor, end]);
  }
  const joined: SpeechRange[] = [];
  for (const range of missing.sort((a, b) => a[0] - b[0])) {
    const last = joined.at(-1);
    if (last && range[0] <= last[1] + 0.001)
      last[1] = Math.max(last[1], range[1]);
    else joined.push([...range]);
  }
  return joined.filter(([start, end]) => end - start >= 0.25);
}

/** A recovery pass can add speech and refine a matching word's timing. It
 * cannot erase words already heard or substitute its spelling wholesale.
 * Matching is monotonic and local in time: repeated takes remain separate. */
export function recoverWords(
  original: RawWord[],
  chunk: TimedAsrChunk,
): RawWord[] {
  const result = original.map((word) => ({ ...word }));
  const candidates = chunk.words.map((word) => ({
    ...word,
    start: word.start + chunk.offset,
    end: word.end + chunk.offset,
  }));
  let after = -1;
  const additions: RawWord[] = [];
  for (const candidate of candidates) {
    const middle = (candidate.start + candidate.end) / 2;
    const match = result.findIndex(
      (word, index) =>
        index > after &&
        token(word.text) === token(candidate.text) &&
        Math.abs((word.start + word.end) / 2 - middle) <= 0.45,
    );
    if (match >= 0) {
      after = match;
      // Short contexts must be comfortably away from their cut boundaries.
      if (
        candidate.start >= chunk.offset + 0.3 &&
        candidate.end <= chunk.offset + chunk.duration - 0.3
      ) {
        result[match] = { ...candidate, text: result[match]!.text };
      }
      continue;
    }
    if (
      candidate.start < chunk.offset + 0.15 ||
      candidate.end > chunk.offset + chunk.duration - 0.15
    )
      continue;
    // An alternative spelling of an occupied moment is not extra speech.
    if (
      result.some(
        (word) => middle >= word.start - 0.04 && middle <= word.end + 0.04,
      )
    )
      continue;
    additions.push(candidate);
  }
  return [...result, ...additions].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
}

function token(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}

/** Bound concurrency and keep one shared deadline, including queued work. */
export async function mapTranscriptionWork<T, R>(
  inputs: T[],
  operation: (input: T) => Promise<R>,
  limit = 6,
): Promise<R[]> {
  const results = new Array<R>(inputs.length);
  let next = 0;
  let failed = false;
  const workers = Array.from(
    { length: Math.min(limit, inputs.length) },
    async () => {
      while (!failed && next < inputs.length) {
        const index = next++;
        try {
          results[index] = await operation(inputs[index]!);
        } catch (error) {
          failed = true;
          throw error;
        }
      }
    },
  );
  const settled = await Promise.allSettled(workers);
  const failure = settled.find((result) => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
  return results;
}
