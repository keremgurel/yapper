"use client";
import DrillPracticeHero from "@/components/training/drill-practice-hero";
export default function HomeHero({
  onJumpToPractice,
}: {
  onJumpToPractice: () => void;
}) {
  return (
    <DrillPracticeHero
      titleTop="Random topic generator"
      titleBottom="for speaking practice"
      description="Pick a topic, set your timer, and practice thinking out loud. Record your answer to listen back, or just give it a try."
      onJumpToPractice={onJumpToPractice}
    />
  );
}
