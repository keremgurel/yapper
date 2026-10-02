import type { DeliveryMetrics } from "@/lib/feedback/metrics";
import type { PronunciationReport } from "@/lib/pronunciation/types";
import type {
  TrainingCoaching,
  TrainingContext,
  TranscriptWord,
} from "@/lib/training-feedback/types";
import AttemptChanges from "@/components/training/feedback/attempt-changes";
import {
  compareAttempts,
  type AttemptSnapshot,
} from "@/components/training/feedback/attempt-comparison";
import DeliveryDetails from "@/components/training/feedback/delivery-details";
import DeliveryGauges from "@/components/training/feedback/delivery-gauges";
import PronunciationSection from "@/components/training/feedback/pronunciation-section";
import NextAttempt from "@/components/training/feedback/next-attempt";
import ReportSection from "@/components/training/feedback/report-section";
import ScoreTiles from "@/components/training/feedback/score-tiles";
import SpeechTimeline from "@/components/training/feedback/speech-timeline";
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
  /** The earlier attempt at this same prompt, when there was one. */
  previous?: AttemptSnapshot | null;
  /** Scores measured from the audio, when the recording could be assessed. */
  pronunciation?: PronunciationReport | null;
}

/**
 * The whole result screen for one training rep. It leads with the one thing
 * to change and the button to try again, because repeating a prompt with a
 * single focus is what improves speaking. Then: the score, what moved since
 * the last attempt, the transcript with corrections, better phrasing, the
 * measured delivery, and the rest of the coach's notes. Purely presentational;
 * the caller fetches and passes everything in.
 */
export default function TrainingFeedbackResult({
  coaching,
  metrics,
  transcript,
  context,
  previous,
  pronunciation,
}: TrainingFeedbackResultProps) {
  const [focus, ...otherImprovements] = coaching.improvements;
  const changes = previous
    ? compareAttempts(previous, { scores: coaching.scores, metrics })
    : [];
  const hasTakeaways =
    coaching.strengths.length > 0 || otherImprovements.length > 0;

  return (
    <div className="space-y-8">
      {focus && <NextAttempt focus={focus} context={context} />}
      <ScoreHero
        scores={coaching.scores}
        overview={coaching.overview}
        context={context}
        previousOverall={previous?.scores?.overall}
      />
      {changes.length > 0 && (
        <ReportSection title="Since your last attempt at this prompt">
          <AttemptChanges changes={changes} />
        </ReportSection>
      )}
      <ReportSection title="Your scores">
        <ScoreTiles scores={coaching.scores} rationales={coaching.rationales} />
      </ReportSection>
      <ReportSection title="How it sounded">
        <SpeechTimeline words={transcript} />
        <DeliveryGauges metrics={metrics} />
        <DeliveryDetails metrics={metrics} />
      </ReportSection>
      {pronunciation && (
        <ReportSection title="Pronunciation and intonation">
          <PronunciationSection report={pronunciation} />
        </ReportSection>
      )}
      <ReportSection title="Transcript">
        <TranscriptSection
          words={transcript}
          corrections={coaching.corrections}
          polishedTranscript={coaching.polishedTranscript}
        />
      </ReportSection>
      {coaching.upgradeLines.length > 0 && (
        <ReportSection title="Better phrasing">
          <UpgradeLines lines={coaching.upgradeLines} />
        </ReportSection>
      )}
      {hasTakeaways && (
        <ReportSection title="Takeaways">
          <StrengthsImprovements
            strengths={coaching.strengths}
            improvements={otherImprovements}
          />
        </ReportSection>
      )}
      {coaching.structuralGaps.length > 0 && (
        <ReportSection title="Structure">
          <StructuralGaps gaps={coaching.structuralGaps} />
        </ReportSection>
      )}
    </div>
  );
}
