import type { Metadata } from "next";
import Link from "next/link";
import TrainingLayout from "@/app/training-layout";
import { TrainingFeedbackResult } from "@/components/training/feedback";
import {
  sampleCoaching,
  sampleContext,
  sampleMetrics,
  samplePrevious,
  sampleTranscript,
} from "@/data/sample-feedback";

export const metadata: Metadata = {
  title: "Sample feedback report",
  description:
    "An example of the AI feedback Yapper Train gives on a recorded practice answer.",
  // Sample content. It explains the product but is not a page to rank.
  robots: { index: false, follow: true },
};

export default function SampleReportPage() {
  return (
    <TrainingLayout footer>
      <div className="marketing-container py-10">
        <p className="text-muted-foreground mb-6 max-w-[70ch] text-sm">
          This is a sample report on a made-up answer, to show what feedback
          looks like.{" "}
          <Link href="/training" className="underline underline-offset-4">
            Record your own
          </Link>{" "}
          to get one on what you said.
        </p>
        <TrainingFeedbackResult
          coaching={sampleCoaching}
          metrics={sampleMetrics}
          transcript={sampleTranscript}
          context={sampleContext}
          previous={samplePrevious}
        />
      </div>
    </TrainingLayout>
  );
}
