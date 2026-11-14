import { afterEach, expect, it, vi } from "vitest";
import {
  LONG_PIECES,
  OVERLAPPING_PIECES,
  transcriptionPiecePlan,
} from "./piece-plan";

afterEach(() => vi.unstubAllEnvs());

it("keeps Deepgram's overlapping pieces by default", () => {
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "");
  vi.stubEnv("ELEVENLABS_API_KEY", "el_test");
  expect(transcriptionPiecePlan()).toEqual(OVERLAPPING_PIECES);
});

it("asks for long pieces when Scribe is offered the take first", () => {
  vi.stubEnv("TRANSCRIPTION_PRIMARY", "elevenlabs");
  vi.stubEnv("ELEVENLABS_API_KEY", "el_test");
  expect(transcriptionPiecePlan()).toEqual(LONG_PIECES);
});

it("never asks for a piece longer than the route accepts", () => {
  // MAX_AUDIO_DURATION_SECONDS in the transcribe route.
  expect(LONG_PIECES.pieceSeconds).toBeLessThanOrEqual(600);
  expect(LONG_PIECES.overlapSeconds).toBeLessThan(LONG_PIECES.pieceSeconds);
});
