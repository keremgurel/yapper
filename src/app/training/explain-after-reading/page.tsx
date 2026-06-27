import type { Metadata } from "next";
import DrillJsonLd from "@/components/training/drill-json-ld";
import DrillPracticePage from "@/components/training/drill-practice-page";
import { getDrill } from "@/data/drills";
import { getRandomFromPool } from "@/lib/practice-helpers";

const drill = getDrill("explain-after-reading")!;

export const metadata: Metadata = {
  title: "Explain After Reading: Free Speaking Practice | Yapper",
  description:
    "Free explain-after-reading speech drill. Read a short passage, hide it, and explain the main idea out loud with a timer and optional recording.",
  alternates: { canonical: "https://ypr.app/training/explain-after-reading" },
};

export default function ExplainAfterReadingPage() {
  const initialTopic = getRandomFromPool(drill.pool, null);

  return (
    <>
      <DrillJsonLd drill={drill} />
      <DrillPracticePage drill={drill} initialTopic={initialTopic} />
    </>
  );
}
