"use client";

import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import PracticeStage from "@/components/practice-stage";
import Waitlist from "@/components/waitlist";
import DrillPracticeHero from "@/components/training/drill-practice-hero";
import DrillSeoSections from "@/components/training/drill-seo-sections";
import TrainingEntryCard from "@/components/training/training-entry-card";
import TrainingHeader from "@/components/training/training-header";
import { Component as Footer } from "@/components/ui/footer-taped-design";
import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { DrillContent } from "@/data/drills";
import type { Topic } from "@/data/topics";

export default function DrillPracticePage({
  drill,
  initialTopic,
}: {
  drill: DrillContent;
  initialTopic: Topic;
}) {
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

      <DrillPracticeHero
        eyebrow={drill.heroEyebrow}
        titleTop={drill.heroTitleTop}
        titleBottom={drill.heroTitleBottom}
        description={drill.heroDescription}
        onJumpToPractice={handleJumpToPractice}
      />

      <PracticeSessionProvider
        initialTopic={initialTopic}
        topicPool={drill.pool}
        initialGenerated
      >
        <ErrorBoundary
          fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
        >
          <PracticeStage />
        </ErrorBoundary>
      </PracticeSessionProvider>

      <DrillSeoSections drill={drill} />

      <TrainingEntryCard />
      <Waitlist variant="full" />
      <Footer />
    </div>
  );
}
