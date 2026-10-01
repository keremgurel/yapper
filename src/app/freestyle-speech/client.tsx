"use client";

import FreestyleHero from "@/components/freestyle-hero";
import MarketingLayout from "@/components/marketing/marketing-layout";
import { StudioSignup } from "@/components/marketing/product-sections";
import PracticeGuide from "@/components/training/practice-guide";
import PracticeStage from "@/components/practice-stage";

import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

interface FreestyleSpeechClientProps {
  initialTopic: Topic;
}

export default function FreestyleSpeechClient({
  initialTopic,
}: FreestyleSpeechClientProps) {
  const handleJumpToPractice = () => {
    const practiceElement = document.getElementById("practice");
    if (!practiceElement) return;

    const rect = practiceElement.getBoundingClientRect();
    const elementCenter = window.scrollY + rect.top + rect.height / 2;
    window.scrollTo({
      top: elementCenter - window.innerHeight / 2,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  };

  return (
    <MarketingLayout>
      <FreestyleHero onJumpToPractice={handleJumpToPractice} />

      <PracticeSessionProvider
        initialTopic={initialTopic}
        mode="freestyle"
        initialSeconds={90}
        drillSlug="freestyle-speech"
        drillTitle="Freestyle speech"
      >
        <PracticeStage />
      </PracticeSessionProvider>

      <PracticeGuide freestyle />
      <StudioSignup />
    </MarketingLayout>
  );
}
