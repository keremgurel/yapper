import type { Metadata } from "next";

import TrainingPageShell from "@/components/training/training-page-shell";
import { programFamilies } from "@/data/training";

const program = programFamilies.find((item) => item.slug === "conflict")!;

export const metadata: Metadata = {
  title: "Conflict practice Training",
  description: program.prompt,
  alternates: {
    canonical: "https://ypr.app/training/conflict",
  },
};

export default function ConflictPage() {
  return <TrainingPageShell program={program} />;
}
