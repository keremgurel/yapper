import type { Metadata } from "next";

import TrainingHub from "@/components/training/training-hub";

export const metadata: Metadata = {
  title: "Camera Speaking Training Programs",
  description:
    "Explore Yapper training programs for freestyle camera reps, explain-after-reading, read-aloud delivery, interview prep, dating, conflict, creator drills, and fluency.",
  alternates: {
    canonical: "https://ypr.app/training",
  },
};

export default function TrainingPage() {
  return <TrainingHub />;
}
