"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import StepCredits from "@/components/training-onboarding/step-credits";
import StepGoals from "@/components/training-onboarding/step-goals";
import StepHeardAbout from "@/components/training-onboarding/step-heard-about";
import StepName from "@/components/training-onboarding/step-name";
import type { TrainingOnboardingData } from "@/hooks/use-training-onboarding";

type Phase = "name" | "goals" | "heardAbout" | "credits";

// Mirrors the motion tokens in globals.css (--sg-ease-out, --sg-dur-base);
// framer-motion needs numbers, not CSS variables.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const DUR_BASE = 0.24;

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Owns the step order and the answers. Nothing here is required: every step
 * can be skipped, and skipping jumps straight to the credits screen so the
 * person still learns what they have before they start.
 */
export default function TrainingOnboardingFlow({
  initialName,
  onComplete,
  onDone,
}: {
  initialName: string;
  onComplete: (
    data: Omit<TrainingOnboardingData, "completedAt">,
  ) => Promise<void>;
  /** Receives the goals just collected. A caller that wants to act on them
   * immediately must not read them back from Clerk, which may not have
   * refreshed its user object yet. */
  onDone: (goals: string[]) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("name");
  const [displayName, setDisplayName] = useState(initialName);
  const [goals, setGoals] = useState<string[]>([]);
  const [heardAbout, setHeardAbout] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onComplete({
        displayName: displayName.trim(),
        goals,
        heardAbout,
      });
      setPhase("credits");
    } catch {
      // Let them retry; the overlay stays up rather than losing their answers.
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
        transition={{ duration: reduceMotion ? 0 : DUR_BASE, ease: EASE_OUT }}
      >
        {phase === "name" && (
          <StepName
            value={displayName}
            onChange={setDisplayName}
            onNext={() => setPhase("goals")}
            onSkip={save}
          />
        )}
        {phase === "goals" && (
          <StepGoals
            selected={goals}
            onToggle={(id) => setGoals((prev) => toggle(prev, id))}
            onBack={() => setPhase("name")}
            onNext={() => setPhase("heardAbout")}
            onSkip={save}
          />
        )}
        {phase === "heardAbout" && (
          <StepHeardAbout
            selected={heardAbout}
            onToggle={(id) => setHeardAbout((prev) => toggle(prev, id))}
            onBack={() => setPhase("goals")}
            onNext={save}
            onSkip={save}
            saving={saving}
          />
        )}
        {phase === "credits" && <StepCredits onDone={() => onDone(goals)} />}
      </motion.div>
    </AnimatePresence>
  );
}
