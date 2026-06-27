import type { Metadata } from "next";
import DrillJsonLd from "@/components/training/drill-json-ld";
import DrillPracticePage from "@/components/training/drill-practice-page";
import { getDrill } from "@/data/drills";
import { getRandomFromPool } from "@/lib/practice-helpers";

const drill = getDrill("read-aloud")!;

export const metadata: Metadata = {
  title: "Read Aloud: Free Speaking Practice | Yapper",
  description:
    "Free read-aloud speaking practice. Train articulation, pacing, and emphasis by reading passages out loud with a timer and optional camera recording.",
  alternates: { canonical: "https://ypr.app/training/read-aloud" },
};

export default function ReadAloudPage() {
  const initialTopic = getRandomFromPool(drill.pool, null);

  return (
    <>
      <DrillJsonLd drill={drill} />
      <DrillPracticePage drill={drill} initialTopic={initialTopic} />
    </>
  );
}
