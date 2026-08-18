import type { Metadata } from "next";

import TrainingLayout from "@/app/training-layout";
import ProgressGate from "@/components/progress/progress-gate";

export const metadata: Metadata = {
  title: "Your progress",
  robots: { index: false, follow: false },
};

export default function ProgressPage() {
  return (
    <TrainingLayout>
      <ProgressGate />
    </TrainingLayout>
  );
}
