import type { Metadata } from "next";

import TrainingPageShell from "@/components/training/training-page-shell";
import { programFamilies } from "@/data/training";

const program = programFamilies.find((item) => item.slug === "dating")!;

export const metadata: Metadata = {
  title: "Dating practice Training",
  description: program.prompt,
  alternates: {
    canonical: "https://ypr.app/training/dating",
  },
};

export default function DatingPage() {
  return <TrainingPageShell program={program} />;
}
