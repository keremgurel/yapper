import { Section } from "@/components/studio-ui";
import type { DeliveryMetrics } from "@/lib/feedback/metrics";
import type {
  TrainingCoaching,
  TrainingContext,
  TranscriptWord,
} from "@/lib/training-feedback/types";
import DeliveryStrip from "@/components/training/feedback/delivery-strip";
import DimensionBreakdown from "@/components/training/feedback/dimension-breakdown";
import ScoreHero from "@/components/training/feedback/score-hero";
import StrengthsImprovements from "@/components/training/feedback/strengths-improvements";
import StructuralGaps from "@/components/training/feedback/structural-gaps";
import TranscriptSection from "@/components/training/feedback/transcript-section";
import UpgradeLines from "@/components/training/feedback/upgrade-lines";

export interface TrainingFeedbackResultProps {
  coaching: TrainingCoaching;
  metrics: DeliveryMetrics;
  transcript: TranscriptWord[];
  context?: TrainingContext | null;
}

/**
 * The whole result screen for one training rep, in reading order: score,
 * dimension breakdown, delivery numbers, the transcript pair, takeaways,
 * better phrasing, and structural gaps. Purely presentational; the caller
 * fetches and passes everything in.
 */
export default function TrainingFeedbackResult({
  coaching,
  metrics,
  transcript,
  context,
}: TrainingFeedbackResultProps) {
  const hasTakeaways =
    coaching.strengths.length > 0 || coaching.improvements.length > 0;

  return (
    <div className="space-y-8">
      <ScoreHero
        scores={coaching.scores}
        overview={coaching.overview}
        context={context}
      />
      <Section title="Breakdown">
        <DimensionBreakdown
          scores={coaching.scores}
          rationales={coaching.rationales}
        />
      </Section>
      <Section title="Delivery">
        <DeliveryStrip metrics={metrics} />
      </Section>
      <Section title="Transcript">
        <TranscriptSection
          words={transcript}
          corrections={coaching.corrections}
          polishedTranscript={coaching.polishedTranscript}
        />
      </Section>
      {hasTakeaways && (
        <Section title="Takeaways">
          <StrengthsImprovements
            strengths={coaching.strengths}
            improvements={coaching.improvements}
          />
        </Section>
      )}
      {coaching.upgradeLines.length > 0 && (
        <Section title="Better phrasing">
          <UpgradeLines lines={coaching.upgradeLines} />
        </Section>
      )}
      {coaching.structuralGaps.length > 0 && (
        <Section title="Structure">
          <StructuralGaps gaps={coaching.structuralGaps} />
        </Section>
      )}
    </div>
  );
}
