"use client";

import ChoiceGrid from "@/components/training-onboarding/choice-grid";
import StepShell from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { PRACTICE_GOALS } from "@/data/training-onboarding";

export default function StepGoals({
  selected,
  onToggle,
  onBack,
  onNext,
  onSkip,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      stepIndex={1}
      stepCount={3}
      title="What are you practicing for?"
      subtitle="An interview answer and a first date are judged differently. This tells your coach which one to hold you to. Pick as many as apply."
      onBack={onBack}
      onSkip={onSkip}
      footer={
        <Button className="w-full" size="lg" onClick={onNext}>
          Continue
        </Button>
      }
    >
      <ChoiceGrid
        label="What you are practicing for"
        options={PRACTICE_GOALS}
        selected={selected}
        onToggle={onToggle}
      />
    </StepShell>
  );
}
