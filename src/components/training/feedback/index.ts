/**
 * The training feedback result screen. `TrainingFeedbackResult` is the whole
 * page body; the skeleton and error components keep its shape while the rep
 * is being scored or when scoring fails.
 */
export {
  default as TrainingFeedbackResult,
  type TrainingFeedbackResultProps,
} from "@/components/training/feedback/training-feedback-result";
export { default as FeedbackSkeleton } from "@/components/training/feedback/feedback-skeleton";
export { default as FeedbackError } from "@/components/training/feedback/feedback-error";
export { default as ScoreHero } from "@/components/training/feedback/score-hero";
export { default as DimensionBreakdown } from "@/components/training/feedback/dimension-breakdown";
export { default as DeliveryStrip } from "@/components/training/feedback/delivery-strip";
export { default as TranscriptSection } from "@/components/training/feedback/transcript-section";
export { default as StrengthsImprovements } from "@/components/training/feedback/strengths-improvements";
export { default as UpgradeLines } from "@/components/training/feedback/upgrade-lines";
export { default as StructuralGaps } from "@/components/training/feedback/structural-gaps";
