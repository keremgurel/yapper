import type { Metadata } from "next";
import { Show } from "@clerk/nextjs";
import TrainingLayout from "@/app/training-layout";
import ProgressSignedOut from "@/components/progress/progress-signed-out";
import ProgressView from "@/components/progress/progress-view";

export const metadata: Metadata = {
  title: "Your progress",
  robots: { index: false, follow: false },
};

export default function ProgressPage() {
  return (
    <TrainingLayout>
      <Show when="signed-in">
        <ProgressView />
      </Show>
      <Show when="signed-out">
        <ProgressSignedOut />
      </Show>
    </TrainingLayout>
  );
}
