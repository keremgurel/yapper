/**
 * Hand-written JSON Schemas for the two training-feedback shots, sent to the
 * provider as strict `json_schema` response formats. This repo has no zod, so
 * these are plain objects; the shapes here bound what the model may emit, and
 * `coach.ts` still sanitizes everything on the way in because a gateway can
 * silently downgrade strict mode.
 *
 * Numeric ranges are deliberately absent: strict structured-output support for
 * minimum/maximum varies by provider, and the clamp in `coach.ts` is the
 * enforcement that actually counts.
 */

import {
  CORRECTION_TYPES,
  STRUCTURAL_GAP_KINDS,
  TRAINING_DIMENSIONS,
} from "./types";

type JsonSchema = Record<string, unknown>;

const score: JsonSchema = { type: "integer" };
const rationale: JsonSchema = { type: "string" };

const dimensionProperties = (shape: JsonSchema): JsonSchema =>
  Object.fromEntries(TRAINING_DIMENSIONS.map((d) => [d, shape]));

/** Shot 1: the five dimension scores, a holistic overall, and one rationale
 * per dimension. Nothing else, so the scoring pass cannot drift into coaching. */
export const SCORING_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "rationales"],
  properties: {
    scores: {
      type: "object",
      additionalProperties: false,
      required: [...TRAINING_DIMENSIONS, "overall"],
      properties: { ...dimensionProperties(score), overall: score },
    },
    rationales: {
      type: "object",
      additionalProperties: false,
      required: [...TRAINING_DIMENSIONS],
      properties: dimensionProperties(rationale),
    },
  },
};

/** Shot 2: everything the coach says, anchored to shot 1's scores. Corrections
 * are index-addressed spans against the tokenized transcript; the server
 * resolves them to verbatim text and timestamps. */
export const COACHING_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overview",
    "strengths",
    "improvements",
    "corrections",
    "upgradeLines",
    "polishedTranscript",
    "structuralGaps",
  ],
  properties: {
    overview: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "wordIndex", "wordCount", "fix", "note"],
        properties: {
          type: { type: "string", enum: [...CORRECTION_TYPES] },
          wordIndex: { type: "integer" },
          wordCount: { type: "integer" },
          fix: { type: ["string", "null"] },
          note: { type: "string" },
        },
      },
    },
    upgradeLines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["before", "after"],
        properties: {
          before: { type: "string" },
          after: { type: "string" },
        },
      },
    },
    polishedTranscript: { type: "string" },
    structuralGaps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "severity", "note"],
        properties: {
          kind: { type: "string", enum: [...STRUCTURAL_GAP_KINDS] },
          severity: { type: "string", enum: ["medium", "high"] },
          note: { type: "string" },
        },
      },
    },
  },
};

/** OpenAI-compatible `response_format` payloads for the Surplus gateway. */
export const SCORING_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "training_scoring",
    strict: true,
    schema: SCORING_SCHEMA,
  },
} as const;

export const COACHING_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "training_coaching",
    strict: true,
    schema: COACHING_SCHEMA,
  },
} as const;
