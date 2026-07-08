"use client";

import { Button } from "@/components/ui/button";
import StepShell from "@/components/onboarding/step-shell";
import LinkListInput from "@/components/onboarding/link-list-input";

/** A generic "paste some links" step, reused for social handles, favorite
 * creators, and favorite videos. `onSkip` is passed only for the optional
 * (creators/videos) steps. */
export default function StepLinks({
  stepIndex,
  title,
  subtitle,
  placeholder,
  addLabel,
  value,
  onChange,
  onBack,
  onNext,
  onSkip,
  nextLabel = "Continue",
  skipLabel = "Skip for now",
  requireOne = false,
}: {
  stepIndex: number;
  title: string;
  subtitle: string;
  placeholder: string;
  addLabel: string;
  value: string[];
  onChange: (next: string[]) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  skipLabel?: string;
  requireOne?: boolean;
}) {
  const hasOne = value.some((v) => v.trim().length > 0);
  return (
    <StepShell
      stepIndex={stepIndex}
      title={title}
      subtitle={subtitle}
      onBack={onBack}
      footer={
        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            size="lg"
            onClick={onNext}
            disabled={requireOne && !hasOne}
          >
            {nextLabel}
          </Button>
          {onSkip && (
            <Button
              variant="ghost"
              className="text-muted-foreground w-full"
              onClick={onSkip}
            >
              {skipLabel}
            </Button>
          )}
        </div>
      }
    >
      <LinkListInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        addLabel={addLabel}
      />
    </StepShell>
  );
}
