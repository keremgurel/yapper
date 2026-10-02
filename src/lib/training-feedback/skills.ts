/**
 * The four things a report shows a speaker, in the order every surface shows
 * them. They are what a listener actually experiences: could I understand you,
 * did it flow, did your voice carry it, and could I follow the point.
 *
 * The coach scores five narrower dimensions (see `TRAINING_DIMENSIONS`) and
 * the audio is measured separately for pronunciation. The skills are derived
 * from both, so reports stored before the skills existed can still show them.
 */

import type { PronunciationReport } from "@/lib/pronunciation/types";
import type { TrainingRationales, TrainingScores } from "./types";

export const SKILLS = ["clear", "fluent", "expressive", "structured"] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<Skill, string> = {
  clear: "Clear",
  fluent: "Fluent",
  expressive: "Expressive",
  structured: "Structured",
};

export const SKILL_BLURBS: Record<Skill, string> = {
  clear:
    "How easily a listener understands you: your sounds, your grammar and your word choice.",
  fluent:
    "How smoothly it flows: pace, pauses in the right places, and few fillers.",
  expressive:
    "How much your voice carries the meaning: stress, rhythm and pitch.",
  structured:
    "Whether the point arrives in an order a listener can follow, from the opening to the close.",
};

/** Expressive comes only from the audio, so it is null when the recording
 * could not be assessed. The other three always have a value. */
export type SkillScores = Record<Exclude<Skill, "expressive">, number> & {
  expressive: number | null;
};

const blend = (...parts: [number, number][]) =>
  Math.round(parts.reduce((sum, [value, weight]) => sum + value * weight, 0));

/**
 * Derive the four skills. Where the audio was assessed, what was measured from
 * it counts alongside the coach's reading of the transcript; where it was not,
 * the coach's scores stand alone.
 */
export function skillScores(
  scores: TrainingScores,
  pronunciation?: PronunciationReport | null,
): SkillScores {
  return {
    clear: pronunciation
      ? blend(
          [pronunciation.accuracy, 0.4],
          [scores.language, 0.35],
          [scores.vocabulary, 0.25],
        )
      : blend([scores.language, 0.6], [scores.vocabulary, 0.4]),
    fluent: pronunciation
      ? blend([scores.delivery, 0.6], [pronunciation.fluency, 0.4])
      : Math.round(scores.delivery),
    expressive: pronunciation?.prosody ?? null,
    structured: blend([scores.clarity, 0.6], [scores.impact, 0.4]),
  };
}

const join = (...parts: (string | undefined)[]) =>
  parts.filter((part) => part?.trim()).join(" ");

/** The coach's reasons, regrouped under the skill each one explains. Empty
 * when the coach gave none for that skill. */
export function skillReasons(
  rationales: Partial<TrainingRationales> | null | undefined,
): Record<Skill, string> {
  return {
    clear: join(rationales?.language, rationales?.vocabulary),
    fluent: join(rationales?.delivery),
    // Explained by the pronunciation section, which has the measurements.
    expressive: "",
    structured: join(rationales?.clarity, rationales?.impact),
  };
}
