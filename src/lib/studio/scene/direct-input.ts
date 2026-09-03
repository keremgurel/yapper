import {
  boundedArray,
  finiteBetween,
  optionalNumber,
  optionalString,
  record,
  requiredString,
} from "./input-guards";
import { parseTranscriptWords, type TranscriptWord } from "./transcript-words";

export interface DirectSpeakerSample {
  at: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DirectPlacedOverlay {
  name: string;
  at: number;
  duration: number;
  kind: "scene" | "image" | "video";
}

export interface DirectOnScreenText {
  text: string;
  at: number;
}

export interface DirectInput {
  instruction: string;
  words: TranscriptWord[];
  frameAspect?: number;
  speaker: DirectSpeakerSample[];
  placed: DirectPlacedOverlay[];
  texts: DirectOnScreenText[];
  captionBand?: { y: number; height: number };
}

const MAX_INSTRUCTION = 1_000;
const MAX_SPEAKER = 64;
const MAX_PLACED = 200;
const MAX_TEXTS = 200;
const MAX_SECONDS = 7_200;

function parseSpeaker(value: unknown): DirectSpeakerSample[] | null {
  const entries = boundedArray(value, MAX_SPEAKER);
  if (!entries) return null;
  const out: DirectSpeakerSample[] = [];
  for (const entry of entries) {
    const s = record(entry);
    if (
      !s ||
      !finiteBetween(s.at, 0, MAX_SECONDS) ||
      !finiteBetween(s.x, 0, 1) ||
      !finiteBetween(s.y, 0, 1) ||
      !finiteBetween(s.width, 0.001, 1) ||
      !finiteBetween(s.height, 0.001, 1) ||
      s.x + s.width > 1.001 ||
      s.y + s.height > 1.001
    ) {
      return null;
    }
    out.push({ at: s.at, x: s.x, y: s.y, width: s.width, height: s.height });
  }
  return out;
}

function parsePlaced(value: unknown): DirectPlacedOverlay[] | null {
  const entries = boundedArray(value, MAX_PLACED);
  if (!entries) return null;
  const out: DirectPlacedOverlay[] = [];
  for (const entry of entries) {
    const p = record(entry);
    const name = p ? requiredString(p.name, 80) : null;
    if (
      !p ||
      !name ||
      !finiteBetween(p.at, 0, MAX_SECONDS) ||
      !finiteBetween(p.duration, 0, MAX_SECONDS) ||
      (p.kind !== "scene" && p.kind !== "image" && p.kind !== "video")
    ) {
      return null;
    }
    out.push({ name, at: p.at, duration: p.duration, kind: p.kind });
  }
  return out;
}

function parseTexts(value: unknown): DirectOnScreenText[] | null {
  const entries = boundedArray(value, MAX_TEXTS);
  if (!entries) return null;
  const out: DirectOnScreenText[] = [];
  for (const entry of entries) {
    const t = record(entry);
    const text = t ? requiredString(t.text, 80) : null;
    if (!t || !text || !finiteBetween(t.at, 0, MAX_SECONDS)) return null;
    out.push({ text, at: t.at });
  }
  return out;
}

/**
 * Strictly validate the direct pass request: everything here is interpolated
 * into the editorial prompt. Anything outside its bounds fails the request.
 */
export function parseDirectInput(value: unknown): DirectInput | null {
  const body = record(value);
  if (!body) return null;
  const words = parseTranscriptWords(body.words);
  if (!words) return null;
  const instruction = optionalString(body.instruction, MAX_INSTRUCTION);
  if (instruction === null) return null;
  const frameAspect = optionalNumber(body.frameAspect, 0.2, 5);
  if (frameAspect === null) return null;
  const speaker = parseSpeaker(body.speaker);
  const placed = parsePlaced(body.placed);
  const texts = parseTexts(body.texts);
  if (!speaker || !placed || !texts) return null;

  let captionBand: DirectInput["captionBand"];
  if (body.captionBand !== undefined) {
    const band = record(body.captionBand);
    if (
      !band ||
      !finiteBetween(band.y, 0, 1) ||
      !finiteBetween(band.height, 0, 1) ||
      band.y + band.height > 1.001
    ) {
      return null;
    }
    captionBand = { y: band.y, height: band.height };
  }

  return {
    instruction: instruction ?? "",
    words,
    speaker,
    placed,
    texts,
    ...(frameAspect === undefined ? {} : { frameAspect }),
    ...(captionBand === undefined ? {} : { captionBand }),
  };
}
