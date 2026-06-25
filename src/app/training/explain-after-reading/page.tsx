import type { Metadata } from "next";
import ExplainAfterReadingFlow from "@/components/training/explain-after-reading-flow";
import TrainingPageShell from "@/components/training/training-page-shell";
import { explainAfterReadingPrompts } from "@/data/drill-prompts";
import { programFamilies } from "@/data/training";
const program = programFamilies.find(
  (item) => item.slug === "explain-after-reading",
)!;
export const metadata: Metadata = {
  title: "Explain after reading Training",
  description: program.prompt,
  alternates: { canonical: "https://ypr.app/training/explain-after-reading" },
};
export default function ExplainAfterReadingPage() {
  return (
    <TrainingPageShell program={program}>
      <ExplainAfterReadingFlow prompts={explainAfterReadingPrompts} />
    </TrainingPageShell>
  );
}
