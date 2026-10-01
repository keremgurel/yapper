"use client";
import DrillPracticeHero from "@/components/training/drill-practice-hero";
export default function FreestyleHero({
  onJumpToPractice,
}: {
  onJumpToPractice: () => void;
}) {
  return (
    <DrillPracticeHero
      titleTop="Freestyle"
      titleBottom="speaking practice"
      description="No prompt or script. Set a timer and talk about whatever comes to mind. Use a recording to hear your pacing, pauses, and delivery."
      onJumpToPractice={onJumpToPractice}
    />
  );
}
