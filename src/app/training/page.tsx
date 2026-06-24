import type { Metadata } from "next";

import TrainingHub from "@/components/training/training-hub";

export const metadata: Metadata = {
  title: "Speaking Training Drills | Yapper",
  description:
    "Practice speaking with structured drills for fluency, word retrieval, vocal control, summaries, and pressure-ready confidence.",
  alternates: {
    canonical: "https://ypr.app/training",
  },
};

export default function TrainingPage() {
  return <TrainingHub />;
}
