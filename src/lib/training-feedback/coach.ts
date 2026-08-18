/**
 * The two-shot training-feedback client against the Surplus gateway. Shot 1
 * scores at temperature 0 so the same rep lands on the same numbers; shot 2
 * coaches against those numbers as ground truth. Both responses are untrusted:
 * everything is salvaged, clamped, and capped here regardless of what the
 * strict schema promised, because a gateway can quietly drop strict mode.
 */

import type { DeliveryMetrics, FeedbackWord } from "@/lib/feedback/metrics";
import {
  type FeedbackWorkflow,
  remainingFeedbackMs,
} from "@/lib/feedback/workflow";
import { fetchBoundedJson } from "@/lib/http/outbound";
import { type ModelCorrection, resolveCorrections } from "./corrections";
import {
  buildCoachingUserPrompt,
  buildScoringUserPrompt,
  COACHING_SYSTEM_PROMPT,
  SCORING_SYSTEM_PROMPT,
} from "./prompts";
import { COACHING_RESPONSE_FORMAT, SCORING_RESPONSE_FORMAT } from "./schemas";
import {
  CORRECTION_TYPES,
  STRUCTURAL_GAP_KINDS,
  TRAINING_DIMENSIONS,
  type StructuralGap,
  type TrainingCoaching,
  type TrainingContext,
  type TrainingRationales,
  type TrainingScores,
  type UpgradeLine,
} from "./types";

const SHOT_TIMEOUT_MS = 90_000;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
// The coaching shot writes the polished transcript, so it needs real room;
// the scoring shot is eleven numbers and five sentences.
const SCORING_MAX_TOKENS = 1_000;
const COACHING_MAX_TOKENS = 4_000;
const COACHING_TEMPERATURE = 0.3;

export const MAX_CORRECTIONS = 40;
export const MAX_LIST_ITEMS = 6;
export const MAX_UPGRADE_LINES = 8;
export const MAX_STRUCTURAL_GAPS = 2;
export const MAX_CORRECTION_NOTE_CHARS = 160;

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

export interface ScoringResult {
  scores: TrainingScores;
  rationales: TrainingRationales;
}

/** Shot 2's payload after sanitization, with corrections still index-addressed. */
export interface CoachingShot {
  overview: string;
  strengths: string[];
  improvements: string[];
  corrections: ModelCorrection[];
  upgradeLines: UpgradeLine[];
  polishedTranscript: string;
  structuralGaps: StructuralGap[];
}

const clampScore = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(100, Math.max(0, Math.round(v)))
    : 0;

const asRecord = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const strArr = (v: unknown, cap: number): string[] =>
  Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string").slice(0, cap)
    : [];

export function sanitizeScoring(raw: Record<string, unknown>): ScoringResult {
  const scores = asRecord(raw.scores);
  const rationales = asRecord(raw.rationales);
  return {
    scores: {
      ...(Object.fromEntries(
        TRAINING_DIMENSIONS.map((d) => [d, clampScore(scores[d])]),
      ) as Record<(typeof TRAINING_DIMENSIONS)[number], number>),
      overall: clampScore(scores.overall),
    },
    rationales: Object.fromEntries(
      TRAINING_DIMENSIONS.map((d) => [d, str(rationales[d])]),
    ) as TrainingRationales,
  };
}

const isCorrectionType = (v: unknown): v is ModelCorrection["type"] =>
  typeof v === "string" && (CORRECTION_TYPES as readonly string[]).includes(v);

function sanitizeCorrection(v: unknown): ModelCorrection | null {
  const c = asRecord(v);
  if (!isCorrectionType(c.type)) return null;
  if (!Number.isInteger(c.wordIndex) || !Number.isInteger(c.wordCount)) {
    return null;
  }
  if (typeof c.fix !== "string" && c.fix !== null) return null;
  return {
    type: c.type,
    wordIndex: c.wordIndex as number,
    wordCount: c.wordCount as number,
    fix: c.fix,
    note:
      typeof c.note === "string"
        ? c.note.slice(0, MAX_CORRECTION_NOTE_CHARS)
        : null,
  };
}

const isUpgradeLine = (v: unknown): v is UpgradeLine => {
  const u = asRecord(v);
  return typeof u.before === "string" && typeof u.after === "string";
};

const isSeverity = (v: unknown): v is StructuralGap["severity"] =>
  v === "medium" || v === "high";

function sanitizeStructuralGap(v: unknown): StructuralGap | null {
  const g = asRecord(v);
  const kind = g.kind;
  if (
    typeof kind !== "string" ||
    !(STRUCTURAL_GAP_KINDS as readonly string[]).includes(kind)
  ) {
    return null;
  }
  return {
    kind: kind as StructuralGap["kind"],
    severity: isSeverity(g.severity) ? g.severity : "medium",
    note: str(g.note),
  };
}

const sanitizeList = <T>(
  v: unknown,
  cap: number,
  sanitizeEntry: (entry: unknown) => T | null,
): T[] =>
  Array.isArray(v)
    ? v
        .map(sanitizeEntry)
        .filter((entry): entry is T => entry !== null)
        .slice(0, cap)
    : [];

export function sanitizeCoachingShot(
  raw: Record<string, unknown>,
): CoachingShot {
  return {
    overview: str(raw.overview),
    strengths: strArr(raw.strengths, MAX_LIST_ITEMS),
    improvements: strArr(raw.improvements, MAX_LIST_ITEMS),
    corrections: sanitizeList(
      raw.corrections,
      MAX_CORRECTIONS,
      sanitizeCorrection,
    ),
    upgradeLines: sanitizeList(raw.upgradeLines, MAX_UPGRADE_LINES, (v) =>
      isUpgradeLine(v) ? { before: v.before, after: v.after } : null,
    ),
    polishedTranscript: str(raw.polishedTranscript),
    structuralGaps: sanitizeList(
      raw.structuralGaps,
      MAX_STRUCTURAL_GAPS,
      sanitizeStructuralGap,
    ),
  };
}

/** Salvage the outer {...} and JSON.parse it (tolerates fences / prose). */
function salvageJson(content: string): Record<string, unknown> {
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("coach_unparseable");
  return JSON.parse(content.slice(s, e + 1)) as Record<string, unknown>;
}

export const parseScoringShot = (content: string): ScoringResult =>
  sanitizeScoring(salvageJson(content));

export const parseCoachingShot = (content: string): CoachingShot =>
  sanitizeCoachingShot(salvageJson(content));

interface ShotRequest {
  system: string;
  user: string;
  temperature: number;
  maxTokens: number;
  responseFormat: unknown;
}

async function requestShot(
  shot: ShotRequest,
  workflow: FeedbackWorkflow,
): Promise<string> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const model =
    process.env.TRAINING_FEEDBACK_MODEL ??
    process.env.FEEDBACK_MODEL ??
    "gpt-5.4-mini";

  const { response, data } = await fetchBoundedJson<ChatCompletionResponse>(
    `${base}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: shot.temperature,
        max_completion_tokens: shot.maxTokens,
        response_format: shot.responseFormat,
        messages: [
          { role: "system", content: shot.system },
          { role: "user", content: shot.user },
        ],
      }),
    },
    {
      timeoutMs: remainingFeedbackMs(workflow, SHOT_TIMEOUT_MS),
      maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
      signal: workflow.signal,
    },
  );
  if (!response.ok) throw new Error(`coach_${response.status}`);
  return data.choices?.[0]?.message?.content ?? "{}";
}

/**
 * The full two-shot coaching pass: score, then coach against the scores, then
 * resolve the index-addressed corrections onto the real transcript.
 */
export async function runTrainingCoaching(
  words: FeedbackWord[],
  metrics: DeliveryMetrics,
  context: TrainingContext,
  workflow: FeedbackWorkflow,
): Promise<TrainingCoaching> {
  const transcript = words.map((w) => w.text).join(" ");
  const scoring = parseScoringShot(
    await requestShot(
      {
        system: SCORING_SYSTEM_PROMPT,
        user: buildScoringUserPrompt(transcript, metrics, context),
        temperature: 0,
        maxTokens: SCORING_MAX_TOKENS,
        responseFormat: SCORING_RESPONSE_FORMAT,
      },
      workflow,
    ),
  );
  remainingFeedbackMs(workflow);

  const shot = parseCoachingShot(
    await requestShot(
      {
        system: COACHING_SYSTEM_PROMPT,
        user: buildCoachingUserPrompt(
          words,
          scoring.scores,
          scoring.rationales,
          metrics,
          context,
        ),
        temperature: COACHING_TEMPERATURE,
        maxTokens: COACHING_MAX_TOKENS,
        responseFormat: COACHING_RESPONSE_FORMAT,
      },
      workflow,
    ),
  );

  return {
    overview: shot.overview,
    scores: scoring.scores,
    rationales: scoring.rationales,
    strengths: shot.strengths,
    improvements: shot.improvements,
    corrections: resolveCorrections(shot.corrections, words),
    upgradeLines: shot.upgradeLines,
    polishedTranscript: shot.polishedTranscript,
    structuralGaps: shot.structuralGaps,
  };
}
