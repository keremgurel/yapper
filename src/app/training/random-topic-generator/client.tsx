"use client";

import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import HomeHero from "@/components/home-hero";
import MarketingLayout from "@/components/marketing/marketing-layout";
import { StudioSignup } from "@/components/marketing/product-sections";
import PracticeGuide from "@/components/training/practice-guide";
import PracticeStage from "@/components/practice-stage";

import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

interface RandomTopicClientProps {
  initialTopic: Topic;
}

export default function RandomTopicClient({
  initialTopic,
}: RandomTopicClientProps) {
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
      <HomeHero onJumpToPractice={handleJumpToPractice} />

      <PracticeSessionProvider
        initialTopic={initialTopic}
        drillSlug="random-topic-generator"
        drillTitle="Random topic generator"
      >
        <ErrorBoundary
          fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
        >
          <PracticeStage />
        </ErrorBoundary>
      </PracticeSessionProvider>

      <PracticeGuide />
      <StudioSignup />
    </MarketingLayout>
  );
}
