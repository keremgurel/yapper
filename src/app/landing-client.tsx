"use client";

import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import HomeHero from "@/components/home-hero";
import PracticeStage from "@/components/practice-stage";
import CreateFlowSection from "@/components/create/create-flow-section";
import { HomeFaq } from "@/components/home-faq";
import Waitlist from "@/components/waitlist";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import TrainingHeader from "@/components/training/training-header";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { Topic } from "@/data/topics";

interface LandingClientProps {
  initialTopic: Topic;
}

export default function LandingClient({ initialTopic }: LandingClientProps) {
  const handleJumpToPractice = () => {
    const practiceElement = document.getElementById("practice");
    if (!practiceElement) return;

    const rect = practiceElement.getBoundingClientRect();
    const elementCenter = window.scrollY + rect.top + rect.height / 2;
    window.scrollTo({
      top: elementCenter - window.innerHeight / 2,
      behavior: "smooth",
    });
  };

  return (
    <div className="flex min-h-screen flex-col transition-colors duration-300">
      <TrainingHeader />

      <HomeHero onJumpToPractice={handleJumpToPractice} />

      <PracticeSessionProvider initialTopic={initialTopic}>
        <ErrorBoundary
          fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
        >
          <PracticeStage />
        </ErrorBoundary>
      </PracticeSessionProvider>

      <CreateFlowSection />

      <Waitlist variant="full" />

      <HomeFaq />

      <Footer />
    </div>
  );
}
