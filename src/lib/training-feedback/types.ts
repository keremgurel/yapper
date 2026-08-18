/**
 * The contract for training feedback: what a coached practice rep produces and
 * what every surface (API route, result screen, progress dashboard) agrees on.
 *
 * This is deliberately separate from `src/lib/feedback/coach.ts`. That one
 * coaches a creator on a clip they are about to post and judges delivery and
 * on-camera presence. Training feedback judges the English itself as well:
 * grammar, word choice, phrasing, and how clearly the point landed. Keeping
 * them apart means neither prompt has to hedge about which job it is doing.
 */

import type { DeliveryMetrics } from "@/lib/feedback/metrics";

/** The five things a rep is scored on, in the order every surface shows them. */
export const TRAINING_DIMENSIONS = [
  "clarity",
  "language",
  "vocabulary",
  "delivery",
  "impact",
] as const;

export type TrainingDimension = (typeof TRAINING_DIMENSIONS)[number];

/** Display copy for a dimension. One source so the API, the result screen and
 * the dashboard never drift into three different names for the same score. */
export const DIMENSION_LABELS: Record<TrainingDimension, string> = {
  clarity: "Clarity and structure",
  language: "Grammar and accuracy",
  vocabulary: "Vocabulary and range",
  delivery: "Delivery",
  impact: "Impact",
};

export const DIMENSION_BLURBS: Record<TrainingDimension, string> = {
  clarity: "Whether the point arrives, and in an order a listener can follow.",
  language:
    "Sentence-level correctness: tense, agreement, articles, prepositions.",
  vocabulary:
    "Range and precision of word choice, and whether it fits the register.",
  delivery: "Pace, pauses, and filler habits, measured from your own audio.",
  impact: "Whether the opening earns attention and the ending lands.",
};

/** Every score is 0-100. A band scale would be borrowed from an exam this
 * product is not preparing anyone for. */
export type TrainingScores = Record<TrainingDimension, number> & {
  overall: number;
};

/** One or two sentences per dimension explaining the number it sits under. */
export type TrainingRationales = Record<TrainingDimension, string>;

export const CORRECTION_TYPES = [
  "grammar",
  "vocabulary",
  "phrasing",
  "filler",
  "clarity",
] as const;

export type CorrectionType = (typeof CORRECTION_TYPES)[number];

/**
 * One concrete, span-anchored issue in what the speaker actually said. The
 * model returns word indices against the tokenized transcript; the server
 * resolves those to the verbatim text and its timestamps so the result screen
 * can annotate the transcript inline and seek the audio to the moment.
 */
export interface TrainingCorrection {
  type: CorrectionType;
  /** Verbatim span from the transcript, resolved server-side. */
  original: string;
  /** The corrected form. Null when the right fix is to delete the span. */
  fix: string | null;
  /** One actionable line explaining the rule or the reason. */
  note: string | null;
  /** Seconds into the recording, when word timings were available. */
  start: number | null;
  end: number | null;
}

/** A whole line worth re-saying a better way. */
export interface UpgradeLine {
  before: string;
  after: string;
}

export const STRUCTURAL_GAP_KINDS = ["missing_hook", "missing_close"] as const;
export type StructuralGapKind = (typeof STRUCTURAL_GAP_KINDS)[number];

/** An absence the transcript cannot show inline. */
export interface StructuralGap {
  kind: StructuralGapKind;
  severity: "medium" | "high";
  note: string;
}

/** Everything the coach says about one rep. */
export interface TrainingCoaching {
  /** Two or three sentences, consistent with the scores. */
  overview: string;
  scores: TrainingScores;
  rationales: TrainingRationales;
  strengths: string[];
  improvements: string[];
  corrections: TrainingCorrection[];
  upgradeLines: UpgradeLine[];
  /**
   * The same answer in clean, natural English, built from the speaker's own
   * ideas rather than a new answer. This is the single most useful artifact
   * for a learner, so it is a required field rather than an optional extra.
   */
  polishedTranscript: string;
  structuralGaps: StructuralGap[];
}

/** What the speaker was answering, so the coach can judge relevance. */
export interface TrainingContext {
  /** Which practice tool the rep came from, e.g. "random-topic-generator". */
  drillSlug: string | null;
  /** Human name of that tool, for the result screen and history. */
  drillTitle: string | null;
  /** The prompt text on screen while they spoke. */
  prompt: string;
  /** The timer they set, in seconds, when there was one. */
  targetSeconds: number | null;
  /**
   * Ids from `PRACTICE_GOALS`, collected at onboarding. An interview answer
   * and a first date are held to different registers, so the coach needs to
   * know which one it is judging against. Empty when the user skipped setup.
   */
  goals: string[];
}

/** The `submissions.feedback` payload for a training rep. */
export interface TrainingFeedbackRecord {
  metrics: DeliveryMetrics;
  coaching: TrainingCoaching;
  context: TrainingContext;
}

/** Successful response from POST /api/training/feedback. */
export interface TrainingFeedbackResponse {
  submissionId: string;
  balance: number;
  metrics: DeliveryMetrics;
  coaching: TrainingCoaching;
  context: TrainingContext;
  transcript: TranscriptWord[];
}

export interface TranscriptWord {
  text: string;
  start: number;
  end: number;
}

/** Score bands used for color and copy. Kept here so the result screen and the
 * progress dashboard label the same number the same way. */
export type ScoreBand = "needs-work" | "developing" | "solid" | "strong";

export function scoreBand(score: number): ScoreBand {
  if (score < 45) return "needs-work";
  if (score < 65) return "developing";
  if (score < 82) return "solid";
  return "strong";
}

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  "needs-work": "Needs work",
  developing: "Developing",
  solid: "Solid",
  strong: "Strong",
};
