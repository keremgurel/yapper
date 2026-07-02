import type { Metadata } from "next";
import DrillJsonLd from "@/components/training/drill-json-ld";
import DrillPracticePage from "@/components/training/drill-practice-page";
import { getDrill } from "@/data/drills";
import { getRandomFromPool } from "@/lib/practice-helpers";

const drill = getDrill("dating")!;

export const metadata: Metadata = {
  title: "Dating & Social Conversation Practice",
  description:
    "Free dating and social conversation practice. Rehearse warm, playful, specific answers with a timer and optional recording, no sign-up.",
  alternates: { canonical: "https://ypr.app/training/dating" },
};

export default function DatingPage() {
  const initialTopic = getRandomFromPool(drill.pool, null);

  return (
    <>
      <DrillJsonLd drill={drill} />
      <DrillPracticePage drill={drill} initialTopic={initialTopic} />
    </>
  );
}
