/**
 * Defensive parsing of the `submissions.scores` and `submissions.context`
 * jsonb payloads. The database column is untyped, so the route never trusts
 * it: a malformed payload becomes null (scores) or a filled-with-nulls
 * context, never a runtime error on the dashboard.
 */

import {
  TRAINING_DIMENSIONS,
  type TrainingContext,
  type TrainingScores,
} from "@/lib/training-feedback/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** All six numbers or nothing: a partial score set cannot be averaged or
 * charted honestly. */
export function parseTrainingScores(value: unknown): TrainingScores | null {
  if (!isRecord(value)) return null;
  const scores: Partial<TrainingScores> = {};
  for (const key of [...TRAINING_DIMENSIONS, "overall"] as const) {
    const score = asScore(value[key]);
    if (score === null) return null;
    scores[key] = score;
  }
  return scores as TrainingScores;
}

/** Tolerant: whatever fields are present and well-typed survive, the rest
 * become nulls, and a non-object becomes null outright. */
export function parseTrainingContext(value: unknown): TrainingContext | null {
  if (!isRecord(value)) return null;
  return {
    drillSlug: typeof value.drillSlug === "string" ? value.drillSlug : null,
    drillTitle: typeof value.drillTitle === "string" ? value.drillTitle : null,
    prompt: typeof value.prompt === "string" ? value.prompt : "",
    targetSeconds:
      typeof value.targetSeconds === "number" &&
      Number.isFinite(value.targetSeconds)
        ? value.targetSeconds
        : null,
    goals: Array.isArray(value.goals)
      ? value.goals.filter((goal): goal is string => typeof goal === "string")
      : [],
  };
}
