import type { Metadata } from "next";
import DrillJsonLd from "@/components/training/drill-json-ld";
import DrillPracticePage from "@/components/training/drill-practice-page";
import { getDrill } from "@/data/drills";
import { getRandomFromPool } from "@/lib/practice-helpers";

const drill = getDrill("interview-prep")!;

export const metadata: Metadata = {
  title: "Interview Answer Practice: Free & No Sign-Up",
  description:
    "Free interview answer practice. Get behavioral questions, set a timer, and record concise STAR-style answers, then review your delivery.",
  alternates: { canonical: "https://ypr.app/training/interview-prep" },
};

export default function InterviewPrepPage() {
  const initialTopic = getRandomFromPool(drill.pool, null);

  return (
    <>
      <DrillJsonLd drill={drill} />
      <DrillPracticePage drill={drill} initialTopic={initialTopic} />
    </>
  );
}
