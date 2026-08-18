"use client";

import FreestyleHero from "@/components/freestyle-hero";
import PracticeStage from "@/components/practice-stage";
import { FreestyleFaq } from "@/components/freestyle-faq";
import Waitlist from "@/components/waitlist";
import TrainingEntryCard from "@/components/training/training-entry-card";
import TrainingHeader from "@/components/training/training-header";
import { Component as Footer } from "@/components/ui/footer-taped-design";

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
      behavior: "smooth",
    });
  };

  return (
    <div className="flex min-h-screen flex-col transition-colors duration-300">
      <TrainingHeader />

      <FreestyleHero onJumpToPractice={handleJumpToPractice} />

      <PracticeSessionProvider
        initialTopic={initialTopic}
        mode="freestyle"
        drillSlug="freestyle-speech"
        drillTitle="Freestyle speech"
      >
        <PracticeStage />
      </PracticeSessionProvider>

      <TrainingEntryCard />

      <Waitlist variant="full" />
      <FreestyleFaq />
      <Footer />
    </div>
  );
}
