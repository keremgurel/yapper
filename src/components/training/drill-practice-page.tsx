"use client";

import {
  ErrorBoundary,
  PracticeErrorFallback,
} from "@/components/ErrorBoundary";
import MarketingLayout from "@/components/marketing/marketing-layout";
import { StudioSignup } from "@/components/marketing/product-sections";
import PracticeStage from "@/components/practice-stage";

import DrillPracticeHero from "@/components/training/drill-practice-hero";
import DrillSeoSections from "@/components/training/drill-seo-sections";

import { PracticeSessionProvider } from "@/contexts/practice-session";
import type { DrillContent } from "@/data/drills";
import { programFamilies } from "@/data/training";
import { getTrainingMode } from "@/data/training-modes";
import type { Topic } from "@/data/topics";

export default function DrillPracticePage({
  drill,
  initialTopic,
}: {
  drill: DrillContent;
  initialTopic: Topic;
}) {
  // The drill's public name lives in the program catalog, not in its content
  // blob, so the feedback context and the marketing card cannot drift apart.
  const drillTitle =
    programFamilies.find((program) => program.slug === drill.slug)?.title ??
    drill.heroEyebrow;

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
      <DrillPracticeHero
        eyebrow={drill.heroEyebrow}
        titleTop={drill.heroTitleTop}
        titleBottom={drill.heroTitleBottom}
        description={drill.heroDescription}
        onJumpToPractice={handleJumpToPractice}
      />

      <PracticeSessionProvider
        initialTopic={initialTopic}
        drillSlug={drill.slug}
        drillTitle={drillTitle}
        topicPool={drill.pool}
        initialGenerated
        initialSeconds={getTrainingMode(drill.slug)?.seconds ?? 60}
      >
        <ErrorBoundary
          fallback={({ reset }) => <PracticeErrorFallback reset={reset} />}
        >
          <PracticeStage />
        </ErrorBoundary>
      </PracticeSessionProvider>

      <DrillSeoSections drill={drill} />

      <StudioSignup />
    </MarketingLayout>
  );
}
