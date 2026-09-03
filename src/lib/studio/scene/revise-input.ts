import {
  parseDesignBox,
  parseDuration,
  parseFrame,
  type DesignBox,
} from "./design-input";
import { optionalString, record, requiredString } from "./input-guards";
import { parseTranscriptWords, type TranscriptWord } from "./transcript-words";

export interface RestyleInput {
  op: "restyle";
  instruction: string;
  asset: {
    name: string;
    description: string;
    brief: string;
    quote: string;
    /** Whatever the client stored. Re-validated by `validateScene` before use. */
    scene: unknown;
  };
  box: DesignBox;
  frameAspect: number;
  frameHeightPx: number;
  duration: number;
}

export interface RetimeInput {
  op: "retime";
  instruction: string;
  words: TranscriptWord[];
  quoteHint?: string;
}

export type ReviseInput = RestyleInput | RetimeInput;

/** The stored scene as JSON text. Anything larger is not a scene we wrote. */
const MAX_SCENE_BYTES = 64 * 1024;

function parseRestyle(body: Record<string, unknown>): RestyleInput | null {
  const instruction = requiredString(body.instruction, 1_000);
  const asset = record(body.asset);
  const frame = parseFrame(body);
  const box = parseDesignBox(body.box);
  const duration = parseDuration(body.duration);
  if (!instruction || !asset || !frame || !box || duration === null)
    return null;
  const name = optionalString(asset.name, 80);
  const description = optionalString(asset.description, 200);
  const brief = optionalString(asset.brief, 600);
  const quote = optionalString(asset.quote, 400);
  if (
    name === null ||
    description === null ||
    brief === null ||
    quote === null
  ) {
    return null;
  }
  const scene = record(asset.scene);
  if (!scene) return null;
  let serialised: string;
  try {
    serialised = JSON.stringify(scene);
  } catch {
    return null;
  }
  if (serialised.length > MAX_SCENE_BYTES) return null;
  return {
    op: "restyle",
    instruction,
    asset: {
      name: name ?? "",
      description: description ?? "",
      brief: brief ?? "",
      quote: quote ?? "",
      scene,
    },
    box,
    ...frame,
    duration,
  };
}

function parseRetime(body: Record<string, unknown>): RetimeInput | null {
  const instruction = requiredString(body.instruction, 1_000);
  const words = parseTranscriptWords(body.words);
  const quoteHint = optionalString(body.quoteHint, 400);
  if (!instruction || !words || quoteHint === null) return null;
  return {
    op: "retime",
    instruction,
    words,
    ...(quoteHint === undefined ? {} : { quoteHint }),
  };
}

/**
 * Strictly validate a revision request. `op` picks the shape: a restyle
 * carries the scene to change, a retime carries the transcript to search.
 */
export function parseReviseInput(value: unknown): ReviseInput | null {
  const body = record(value);
  if (!body) return null;
  const op = body.op ?? "restyle";
  if (op === "restyle") return parseRestyle(body);
  if (op === "retime") return parseRetime(body);
  return null;
}
