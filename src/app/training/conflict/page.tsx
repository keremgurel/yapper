import type { Metadata } from "next";
import DrillPracticeFlow from "@/components/training/drill-practice-flow";
import TrainingPageShell from "@/components/training/training-page-shell";
import { conflictPrompts } from "@/data/drill-prompts";
import { programFamilies } from "@/data/training";
const program = programFamilies.find((item) => item.slug === "conflict")!;
export const metadata: Metadata = {
  title: "Conflict handling Training",
  description: program.prompt,
  alternates: { canonical: "https://ypr.app/training/conflict" },
};
export default function ConflictPage() {
  return (
    <TrainingPageShell program={program}>
      <DrillPracticeFlow
        eyebrow="Conflict rep"
        title="Clear, calm, and brief."
        intro="Practice tense sentences before you need them, so disagreement stays direct instead of spiraling."
        prompts={conflictPrompts}
        suggestedTime="60-90 sec"
        instructions={[
          "Start by naming what you heard or what happened.",
          "State your view in one plain sentence without piling on extra evidence.",
          "Ask for the next behavior or decision you want.",
          "Keep your pace slower than normal and leave space after the hard sentence.",
        ]}
      />
    </TrainingPageShell>
  );
}
