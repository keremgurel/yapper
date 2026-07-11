"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useStudioOnboarding } from "@/hooks/use-studio-onboarding";
import { Button } from "@/components/ui/button";
import { ChirpyMark } from "@/components/brand/chirpy-mark";
import OnboardingOverlay from "@/components/onboarding/onboarding-overlay";
import OnboardingFlow from "@/components/onboarding/onboarding-flow";

/** The explicit entry point to first-run setup. While a signed-in user hasn't
 * completed onboarding, a calm prompt sits at the top of the surface; the
 * full-screen flow only opens when they click "Set up studio" (never
 * automatically). Once completed, this renders nothing. */
export default function StudioSetupPrompt() {
  const { isLoaded, isSignedIn, onboarded, complete } = useStudioOnboarding();
  const [open, setOpen] = useState(false);

  if (!isLoaded || !isSignedIn || onboarded) return null;

  return (
    <>
      <div className="border-border bg-card mb-6 flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center">
        <ChirpyMark size={40} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-bold">
            Set up your studio
          </p>
          <p className="text-muted-foreground text-sm">
            Tell us where you post and your content pillars so every idea and
            script fits your voice. Takes a minute — skip anything you like.
          </p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="shrink-0 sm:self-center"
        >
          <Sparkles className="h-4 w-4" />
          Set up studio
        </Button>
      </div>

      {open && (
        <OnboardingOverlay onClose={() => setOpen(false)}>
          <OnboardingFlow
            onComplete={async (data) => {
              await complete(data);
              setOpen(false);
            }}
          />
        </OnboardingOverlay>
      )}
    </>
  );
}
