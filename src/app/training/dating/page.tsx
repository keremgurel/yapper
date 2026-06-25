import type { Metadata } from "next";
import DrillPracticeFlow from "@/components/training/drill-practice-flow";
import TrainingPageShell from "@/components/training/training-page-shell";
import { datingSocialPrompts } from "@/data/drill-prompts";
import { programFamilies } from "@/data/training";
const program = programFamilies.find((item) => item.slug === "dating")!;
export const metadata: Metadata = {
  title: "Dating/social practice Training",
  description: program.prompt,
  alternates: { canonical: "https://ypr.app/training/dating" },
};
export default function DatingPage() {
  return (
    <TrainingPageShell program={{ ...program, href: "/training/dating" }}>
      <DrillPracticeFlow
        eyebrow="Dating/social MVP"
        title="Warm, specific, not over-performed."
        intro="Use low-stakes reps to practice playful answers, short stories, and comfortable follow-up questions."
        prompts={datingSocialPrompts}
        suggestedTime="45-75 sec"
        instructions={[
          "Answer with one concrete detail instead of a generic personality claim.",
          "Keep the tone warm and conversational, not audition-mode polished.",
          "Add one natural follow-up question when the prompt calls for it.",
          "Stop while it still feels light. Do not over-explain the bit.",
        ]}
      />
    </TrainingPageShell>
  );
}
