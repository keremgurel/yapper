"use client";

import ChoiceGrid from "@/components/training-onboarding/choice-grid";
import StepShell from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { HEARD_ABOUT_OPTIONS } from "@/data/training-onboarding";

export default function StepHeardAbout({
  selected,
  onToggle,
  onBack,
  onNext,
  onSkip,
  saving,
}: {
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  return (
    <StepShell
      stepIndex={2}
      stepCount={3}
      title="How did you find us?"
      subtitle="Last one. It tells us where to spend our time."
      onBack={onBack}
      onSkip={onSkip}
      footer={
        <Button className="w-full" size="lg" onClick={onNext} disabled={saving}>
          {saving ? "Saving…" : "Finish"}
        </Button>
      }
    >
      <ChoiceGrid
        label="How you heard about Yapper"
        options={HEARD_ABOUT_OPTIONS}
        selected={selected}
        onToggle={onToggle}
      />
    </StepShell>
  );
}
