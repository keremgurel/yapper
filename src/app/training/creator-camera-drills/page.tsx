import type { Metadata } from "next";
import DrillJsonLd from "@/components/training/drill-json-ld";
import DrillPracticePage from "@/components/training/drill-practice-page";
import { getDrill } from "@/data/drills";
import { getRandomFromPool } from "@/lib/practice-helpers";

const drill = getDrill("creator-camera-drills")!;

export const metadata: Metadata = {
  title: "Creator Camera Drills: Practice On-Camera",
  description:
    "Free creator camera drills. Practice hooks, payoffs, and crisp examples on camera with a timer, then rewatch your takes. No sign-up.",
  alternates: { canonical: "https://ypr.app/training/creator-camera-drills" },
};

export default function CreatorCameraDrillsPage() {
  const initialTopic = getRandomFromPool(drill.pool, null);

  return (
    <>
      <DrillJsonLd drill={drill} />
      <DrillPracticePage drill={drill} initialTopic={initialTopic} />
    </>
  );
}
