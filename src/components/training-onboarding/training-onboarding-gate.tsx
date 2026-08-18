"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";

import OnboardingOverlay from "@/components/onboarding/onboarding-overlay";
import TrainingOnboardingFlow from "@/components/training-onboarding/training-onboarding-flow";
import { useTrainingOnboarding } from "@/hooks/use-training-onboarding";

/**
 * Paths where the overlay must never open itself.
 *
 * Studio runs its own setup prompt and sits behind its own gate. The practice
 * pages are excluded for a different reason: someone can be mid-rep with a
 * timer running and a recording in memory, and dropping a modal over that
 * would destroy the take. Those surfaces open this flow deliberately instead,
 * at the moment feedback is requested.
 */
const SILENT_PREFIXES = [
  "/studio",
  // Not covered by "/studio": the gate matches a path or its subtree, and
  // "/studio-access" is a sibling. Someone here is being asked for a password
  // before they can get any further, so a setup modal on top is noise.
  "/studio-access",
  "/training",
  "/freestyle",
  "/progress",
  // Never cover a checkout in progress. Someone on the pricing page is trying
  // to pay; a setup modal over that is pure friction at the worst moment.
  "/pricing",
];

function isSilentPath(pathname: string): boolean {
  return SILENT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Opens the training onboarding once, for a signed-in visitor who has not
 * finished it. Mounted globally so it does not matter which page someone
 * happens to sign in from.
 */
export default function TrainingOnboardingGate() {
  const pathname = usePathname();
  const { user } = useUser();
  const { isLoaded, isSignedIn, onboarded, complete } = useTrainingOnboarding();
  const [dismissed, setDismissed] = useState(false);

  // Whether to show is entirely derivable from session, metadata and route, so
  // it is computed during render rather than pushed into state by an effect.
  const open =
    isLoaded &&
    isSignedIn &&
    !onboarded &&
    !dismissed &&
    !isSilentPath(pathname);

  const close = useCallback(() => setDismissed(true), []);

  if (!open) return null;

  return (
    <OnboardingOverlay onClose={close} label="Get set up">
      <TrainingOnboardingFlow
        initialName={user?.firstName ?? ""}
        onComplete={complete}
        onDone={close}
      />
    </OnboardingOverlay>
  );
}
