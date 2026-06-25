import type { Metadata } from "next";
import DrillPracticeFlow from "@/components/training/drill-practice-flow";
import TrainingPageShell from "@/components/training/training-page-shell";
import { interviewPrepPrompts } from "@/data/drill-prompts";
import { programFamilies } from "@/data/training";
const program = programFamilies.find((item) => item.slug === "interview-prep")!;
export const metadata: Metadata = {
  title: "Interview prep Training",
  description: program.prompt,
  alternates: { canonical: "https://ypr.app/training/interview-prep" },
};
export default function InterviewPrepPage() {
  return (
    <TrainingPageShell program={program}>
      <DrillPracticeFlow
        eyebrow="Interview MVP"
        title="Answer with shape, not script."
        intro="Practice turning interview prompts into concise answers with a situation, action, result, and lesson."
        prompts={interviewPrepPrompts}
        suggestedTime="90-120 sec"
        instructions={[
          "Take 15 seconds to choose one real example.",
          "Open with the headline before you explain the background.",
          "Use situation, action, result, and lesson as a loose spine.",
          "End with what the example proves about how you work now.",
        ]}
      />
    </TrainingPageShell>
  );
}
