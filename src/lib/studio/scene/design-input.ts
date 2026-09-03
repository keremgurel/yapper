import {
  finiteBetween,
  optionalBoolean,
  optionalString,
  record,
  requiredString,
} from "./input-guards";
import { isMomentKind, type MomentKind } from "./moment-kinds";
import { SCENE_LIMITS } from "./scene-limits";

export interface DesignBox {
  /** Width over height. */
  aspect: number;
  widthPx: number;
  heightPx: number;
}

export interface DesignMoment {
  id: string;
  brief: string;
  name: string;
  description: string;
  kind: MomentKind;
  wantsImage: boolean;
  quote: string;
  sentence: string;
  box: DesignBox;
  duration: number;
  wordTimings?: { text: string; at: number; end: number }[];
}

export interface DesignInput {
  instruction: string;
  frameAspect: number;
  frameHeightPx: number;
  moments: DesignMoment[];
}

export const MAX_DESIGN_MOMENTS = 6;
const ID = /^[A-Za-z0-9_-]{1,40}$/;

const FRAME_ASPECT = { min: 0.2, max: 5 };
const FRAME_HEIGHT = { min: 240, max: 4320 };
const BOX_PX = { min: 64, max: 4320 };

export function parseDesignBox(value: unknown): DesignBox | null {
  const box = record(value);
  if (
    !box ||
    !finiteBetween(box.aspect, FRAME_ASPECT.min, FRAME_ASPECT.max) ||
    !finiteBetween(box.widthPx, BOX_PX.min, BOX_PX.max) ||
    !finiteBetween(box.heightPx, BOX_PX.min, BOX_PX.max)
  ) {
    return null;
  }
  return { aspect: box.aspect, widthPx: box.widthPx, heightPx: box.heightPx };
}

export function parseFrame(
  body: Record<string, unknown>,
): { frameAspect: number; frameHeightPx: number } | null {
  if (
    !finiteBetween(body.frameAspect, FRAME_ASPECT.min, FRAME_ASPECT.max) ||
    !finiteBetween(body.frameHeightPx, FRAME_HEIGHT.min, FRAME_HEIGHT.max)
  ) {
    return null;
  }
  return { frameAspect: body.frameAspect, frameHeightPx: body.frameHeightPx };
}

export function parseDuration(value: unknown): number | null {
  return finiteBetween(
    value,
    SCENE_LIMITS.minDuration,
    SCENE_LIMITS.maxDuration,
  )
    ? value
    : null;
}

function parseMoment(value: unknown): DesignMoment | null {
  const m = record(value);
  if (!m || typeof m.id !== "string" || !ID.test(m.id)) return null;
  const brief = requiredString(m.brief, 600);
  const name = optionalString(m.name, 80);
  const description = optionalString(m.description, 200);
  const quote = requiredString(m.quote, 400);
  const sentence = optionalString(m.sentence, 800);
  const wantsImage = optionalBoolean(m.wantsImage);
  const box = parseDesignBox(m.box);
  const duration = parseDuration(m.duration);
  if (
    !brief ||
    name === null ||
    description === null ||
    !quote ||
    sentence === null ||
    wantsImage === null ||
    !isMomentKind(m.kind) ||
    !box ||
    duration === null
  ) {
    return null;
  }
  const wordTimings: NonNullable<DesignMoment["wordTimings"]> = [];
  if (m.wordTimings !== undefined) {
    if (!Array.isArray(m.wordTimings) || m.wordTimings.length > 100)
      return null;
    for (const raw of m.wordTimings) {
      const word = record(raw);
      const text = word && requiredString(word.text, 80);
      if (
        !word ||
        !text ||
        !finiteBetween(word.at, 0, duration) ||
        !finiteBetween(word.end, word.at, duration) ||
        (wordTimings.length > 0 &&
          word.at < wordTimings[wordTimings.length - 1].at)
      )
        return null;
      wordTimings.push({ text, at: word.at, end: word.end });
    }
  }
  return {
    id: m.id,
    brief,
    name: name ?? "",
    description: description ?? "",
    kind: m.kind,
    wantsImage: wantsImage ?? false,
    quote,
    sentence: sentence ?? quote,
    box,
    duration,
    ...(m.wordTimings === undefined ? {} : { wordTimings }),
  };
}

/**
 * Strictly validate the design pass request. The box and frame sizes feed the
 * legibility floor, so they are ranges rather than "any positive number".
 */
export function parseDesignInput(value: unknown): DesignInput | null {
  const body = record(value);
  if (!body) return null;
  const instruction = optionalString(body.instruction, 1_000);
  if (instruction === null) return null;
  const frame = parseFrame(body);
  if (!frame) return null;
  if (
    !Array.isArray(body.moments) ||
    body.moments.length === 0 ||
    body.moments.length > MAX_DESIGN_MOMENTS
  ) {
    return null;
  }
  const moments: DesignMoment[] = [];
  const ids = new Set<string>();
  for (const entry of body.moments) {
    const moment = parseMoment(entry);
    if (!moment || ids.has(moment.id)) return null;
    ids.add(moment.id);
    moments.push(moment);
  }
  return { instruction: instruction ?? "", ...frame, moments };
}
