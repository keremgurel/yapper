import type { Metadata } from "next";

import TrainingPageShell from "@/components/training/training-page-shell";
import { programFamilies } from "@/data/training";

const program = programFamilies.find(
  (item) => item.slug === "explain-after-reading",
)!;

export const metadata: Metadata = {
  title: "Explain after reading Training",
  description: program.prompt,
  alternates: {
    canonical: "https://ypr.app/training/explain-after-reading",
  },
};

export default function ExplainAfterReadingPage() {
  return <TrainingPageShell program={program} />;
}
