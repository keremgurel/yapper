import { elevenLabsPrimaryKey } from "./primary-provider";

/** How the editor should cut a take into pieces before uploading it. */
export interface TranscriptionPiecePlan {
  pieceSeconds: number;
  overlapSeconds: number;
}

/**
 * Deepgram's plan. It drops repeated attempts on long audio, so it gets short
 * pieces that overlap, and recovery passes on top.
 */
export const OVERLAPPING_PIECES: TranscriptionPiecePlan = {
  pieceSeconds: 120,
  overlapSeconds: 30,
};

/**
 * Scribe's plan: pieces as long as the route accepts, joined by a few seconds.
 * On a 21.6 minute take this cut at F1 0.999, a 30 second overlap at 0.992,
 * because a wider seam gives the merge more of two renderings to interleave.
 * A take up to ten minutes is one request, which also keeps a take inside a
 * provider limit of a few requests at a time.
 * Measured in docs/transcription-and-edit-eval-2026-11.md.
 */
export const LONG_PIECES: TranscriptionPiecePlan = {
  pieceSeconds: 600,
  overlapSeconds: 5,
};

/** The plan that suits whichever transcriber a take is offered to first. */
export function transcriptionPiecePlan(): TranscriptionPiecePlan {
  return elevenLabsPrimaryKey() ? LONG_PIECES : OVERLAPPING_PIECES;
}
