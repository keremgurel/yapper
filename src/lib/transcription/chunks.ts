import type { AsrResult } from "@/lib/transcription/providers";

export interface TimedAsrChunk extends AsrResult {
  offset: number;
  duration: number;
}

/**
 * Joins overlapping ASR passes without duplicating the words in the overlap.
 *
 * Each pass owns the half of an overlap nearest its centre. A second recovery
 * pass then restores a word heard by only one side of a seam, provided no other
 * word already occupies that moment. This is what lets chunking protect long
 * takes without recreating the old "word vanished at 6:00" failure.
 */
export function mergeAsrChunks(chunks: TimedAsrChunk[]): AsrResult {
  const ordered = [...chunks].sort((left, right) => left.offset - right.offset);
  if (ordered.length === 0) return { words: [], heardSec: 0 };

  const shifted = ordered.map((chunk) => ({
    ...chunk,
    words: chunk.words.map((word) => ({
      ...word,
      start: word.start + chunk.offset,
      end: word.end + chunk.offset,
    })),
  }));

  const owned = shifted.flatMap((chunk, index) => {
    const left =
      index === 0
        ? -Infinity
        : (chunk.offset +
            shifted[index - 1]!.offset +
            shifted[index - 1]!.duration) /
          2;
    const right =
      index === shifted.length - 1
        ? Infinity
        : (chunk.offset + chunk.duration + shifted[index + 1]!.offset) / 2;
    return chunk.words.filter((word) => {
      const at = midpoint(word);
      return at >= left && at < right;
    });
  });

  const merged = [...owned];
  for (const candidate of shifted.flatMap((chunk) => chunk.words)) {
    const token = normalize(candidate.text);
    if (!token) continue;
    const at = midpoint(candidate);
    if (
      merged.some(
        (word) =>
          normalize(word.text) === token &&
          Math.abs(midpoint(word) - at) <= 0.55,
      )
    ) {
      continue;
    }
    const padding = Math.max(
      0.08,
      Math.min(0.22, (candidate.end - candidate.start) * 0.45),
    );
    if (
      !merged.some(
        (word) =>
          midpoint(word) >= candidate.start - padding &&
          midpoint(word) <= candidate.end + padding,
      )
    ) {
      merged.push(candidate);
    }
  }

  merged.sort(
    (left, right) => left.start - right.start || left.end - right.end,
  );
  return {
    words: merged,
    heardSec: Math.max(
      ...shifted.map((chunk) => chunk.offset + chunk.heardSec),
    ),
  };
}

function midpoint(word: { start: number; end: number }): number {
  return (word.start + word.end) / 2;
}

function normalize(text: string): string {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
}
