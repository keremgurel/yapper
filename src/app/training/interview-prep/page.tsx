import type { Metadata } from "next";

import TrainingPageShell from "@/components/training/training-page-shell";
import { programFamilies } from "@/data/training";

const program = programFamilies.find((item) => item.slug === "interview-prep")!;

export const metadata: Metadata = {
  title: "Interview prep Training",
  description: program.prompt,
  alternates: {
    canonical: "https://ypr.app/training/interview-prep",
  },
};

export default function InterviewPrepPage() {
  return <TrainingPageShell program={program} />;
}
