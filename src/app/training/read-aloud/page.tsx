import type { Metadata } from "next";

import TrainingPageShell from "@/components/training/training-page-shell";
import { programFamilies } from "@/data/training";

const program = programFamilies.find((item) => item.slug === "read-aloud")!;

export const metadata: Metadata = {
  title: "Read aloud Training",
  description: program.prompt,
  alternates: {
    canonical: "https://ypr.app/training/read-aloud",
  },
};

export default function ReadAloudPage() {
  return <TrainingPageShell program={program} />;
}
