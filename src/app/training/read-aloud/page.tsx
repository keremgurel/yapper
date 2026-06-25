import type { Metadata } from "next";
import DrillPracticeFlow from "@/components/training/drill-practice-flow";
import TrainingPageShell from "@/components/training/training-page-shell";
import { readAloudPassages } from "@/data/drill-prompts";
import { programFamilies } from "@/data/training";
const program = programFamilies.find((item) => item.slug === "read-aloud")!;
export const metadata: Metadata = {
  title: "Read aloud Training",
  description: program.prompt,
  alternates: { canonical: "https://ypr.app/training/read-aloud" },
};
export default function ReadAloudPage() {
  return (
    <TrainingPageShell program={program}>
      <DrillPracticeFlow
        eyebrow="Read aloud MVP"
        title="Clarity first, then emphasis."
        intro="Read-aloud practice trains articulation without making you invent content. Repeat the same passage for accuracy, then natural flow."
        prompts={readAloudPassages}
        suggestedTime="60-90 sec"
        instructions={[
          "Scan the passage once for punctuation and tricky words.",
          "Read out loud for clarity: finish word endings and pause at commas or full stops.",
          "Read it again with one deliberate emphasis choice per sentence.",
          "Record if useful, then listen for rushed endings, flat tone, or missing pauses.",
        ]}
        prepNote="Common read-aloud structure: preview the text, read for accuracy, repeat for flow, and vary pace or emphasis without mumbling."
      />
    </TrainingPageShell>
  );
}
