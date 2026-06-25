import type { Metadata } from "next";

import TrainingPageShell from "@/components/training/training-page-shell";
import { programFamilies } from "@/data/training";

const program = programFamilies.find(
  (item) => item.slug === "creator-camera-drills",
)!;

export const metadata: Metadata = {
  title: "Creator camera drills Training",
  description: program.prompt,
  alternates: {
    canonical: "https://ypr.app/training/creator-camera-drills",
  },
};

export default function CreatorCameraDrillsPage() {
  return <TrainingPageShell program={program} />;
}
