import type { Metadata } from "next";
import DrillJsonLd from "@/components/training/drill-json-ld";
import DrillPracticePage from "@/components/training/drill-practice-page";
import { getDrill } from "@/data/drills";
import { getRandomFromPool } from "@/lib/practice-helpers";

const drill = getDrill("conflict")!;

export const metadata: Metadata = {
  title: "Conflict Handling Speaking Practice | Yapper",
  description:
    "Free conflict practice. Rehearse calm, direct responses to tense scenarios out loud with a timer and optional recording, no sign-up.",
  alternates: { canonical: "https://ypr.app/training/conflict" },
};

export default function ConflictPage() {
  const initialTopic = getRandomFromPool(drill.pool, null);

  return (
    <>
      <DrillJsonLd drill={drill} />
      <DrillPracticePage drill={drill} initialTopic={initialTopic} />
    </>
  );
}
