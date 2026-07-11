"use client";

import { useCallback } from "react";
import { useUser } from "@clerk/nextjs";

/** One social account: which platform + the username on it (no URL). */
export interface SocialHandle {
  platform: string;
  username: string;
}

/** Everything first-run onboarding collects. Stored in Clerk `unsafeMetadata`
 * (client-writable, no DB round-trip); `completedAt` is the gate flag. Every
 * field is optional to fill — the whole flow can be skipped and finished later. */
export interface StudioOnboardingData {
  socials: SocialHandle[];
  pillars: string[];
  wantsPillarHelp: boolean;
  /** Optional creator/video links the user pasted (skippable). */
  inspoLinks: string[];
  completedAt?: string;
}

interface StudioMetadata {
  studioOnboarding?: Partial<StudioOnboardingData>;
}

/** Reads/writes the Studio onboarding state on the Clerk user. The completion
 * flag is written ONLY when the flow finishes, so a mid-flow refresh never
 * counts as onboarded. */
export function useStudioOnboarding() {
  const { user, isLoaded, isSignedIn } = useUser();
  const meta = (user?.unsafeMetadata as StudioMetadata | undefined)
    ?.studioOnboarding;
  const onboarded = Boolean(meta?.completedAt);

  const complete = useCallback(
    async (data: Omit<StudioOnboardingData, "completedAt">) => {
      if (!user) return;
      await user.update({
        unsafeMetadata: {
          ...(user.unsafeMetadata ?? {}),
          studioOnboarding: {
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
    onboarded,
    complete,
  };
}
