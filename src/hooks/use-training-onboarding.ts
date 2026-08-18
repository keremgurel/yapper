"use client";

import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";

/** Everything the training onboarding collects. Every field is skippable;
 * `completedAt` is the only thing that decides whether the flow runs again. */
export interface TrainingOnboardingData {
  displayName: string;
  /** Ids from `PRACTICE_GOALS`. Passed to the coach so it judges the right register. */
  goals: string[];
  /** Ids from `HEARD_ABOUT_OPTIONS`. */
  heardAbout: string[];
  completedAt?: string;
}

interface TrainingMetadata {
  trainingOnboarding?: Partial<TrainingOnboardingData>;
}

/**
 * Reads and writes training onboarding state on the Clerk user.
 *
 * It lives in `unsafeMetadata` rather than our own table for the same reason
 * the Studio flow does: it is client-written, needs no server round-trip, and
 * is available the instant the session loads, so the overlay never flashes for
 * someone who already finished.
 *
 * `completedAt` is written only when the flow ends, so a mid-flow refresh does
 * not count as onboarded.
 */
export function useTrainingOnboarding() {
  const { user, isLoaded, isSignedIn } = useUser();
  const stored = (user?.unsafeMetadata as TrainingMetadata | undefined)
    ?.trainingOnboarding;

  const complete = useCallback(
    async (data: Omit<TrainingOnboardingData, "completedAt">) => {
      if (!user) return;
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata ?? {}),
          trainingOnboarding: {
            ...data,
            completedAt: new Date().toISOString(),
          },
        },
      });
    },
    [user],
  );

  return {
    isLoaded,
    isSignedIn: Boolean(isSignedIn),
    onboarded: Boolean(stored?.completedAt),
    goals: stored?.goals ?? [],
    complete,
  };
}
