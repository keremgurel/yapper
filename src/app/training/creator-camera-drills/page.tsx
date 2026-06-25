import type { Metadata } from "next";
import DrillPracticeFlow from "@/components/training/drill-practice-flow";
import TrainingPageShell from "@/components/training/training-page-shell";
import { creatorCameraPrompts } from "@/data/drill-prompts";
import { programFamilies } from "@/data/training";
const program = programFamilies.find(
  (item) => item.slug === "creator-camera-drills",
)!;
export const metadata: Metadata = {
  title: "Creator camera drills Training",
  description: program.prompt,
  alternates: { canonical: "https://ypr.app/training/creator-camera-drills" },
};
export default function CreatorCameraDrillsPage() {
  return (
    <TrainingPageShell program={program}>
      <DrillPracticeFlow
        eyebrow="Creator camera rep"
        title="Hook, payoff, example."
        intro="Practice short-form camera reps with a clear opening, a useful point, and enough specificity to sound real."
        prompts={creatorCameraPrompts}
        suggestedTime="45-90 sec"
        instructions={[
          "Start with the hook in one sentence.",
          "Give the payoff before background context.",
          "Use one concrete example, not a list of abstractions.",
          "End cleanly with the takeaway or next action.",
        ]}
      />
    </TrainingPageShell>
  );
}
