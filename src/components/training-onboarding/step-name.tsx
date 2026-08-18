"use client";

import StepShell from "@/components/onboarding/step-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function StepName({
  value,
  onChange,
  onNext,
  onSkip,
}: {
  value: string;
  onChange: (value: string) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <StepShell
      stepIndex={0}
      stepCount={3}
      title="What should we call you?"
      subtitle="Your coach uses it when it talks to you, and it sits on your progress page."
      onSkip={onSkip}
      footer={
        <Button className="w-full" size="lg" onClick={onNext}>
          Continue
        </Button>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onNext();
        }}
      >
        <label htmlFor="onboarding-name" className="sr-only">
          Your name
        </label>
        <Input
          id="onboarding-name"
          autoFocus
          value={value}
          maxLength={60}
          onChange={(event) => onChange(event.target.value)}
          placeholder="First name is fine"
        />
      </form>
    </StepShell>
  );
}
