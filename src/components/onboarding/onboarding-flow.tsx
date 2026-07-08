"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type {
  SocialHandle,
  StudioOnboardingData,
} from "@/hooks/use-studio-onboarding";
import { Button } from "@/components/ui/button";
import StepWelcome from "@/components/onboarding/step-welcome";
import StepPlatforms from "@/components/onboarding/step-platforms";
import StepLinks from "@/components/onboarding/step-links";
import StepPillars from "@/components/onboarding/step-pillars";

type Phase = "welcome" | "socials" | "pillars" | "inspiration";

const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
const cleanSocials = (arr: SocialHandle[]) =>
  arr
    .map((s) => ({ ...s, username: s.username.trim() }))
    .filter((s) => s.username.length > 0);

/** Owns onboarding state + step order. Nothing here is required — the user opens
 * this deliberately and can skip any step (or the whole thing) and finish later.
 * The completion flag is written when they finish OR skip to the end. */
export default function OnboardingFlow({
  onComplete,
}: {
  onComplete: (
    data: Omit<StudioOnboardingData, "completedAt">,
  ) => Promise<void>;
}) {
  const [phase, setPhase] = useState<Phase>("welcome");
  // Start empty; StepPlatforms leads with Instagram as the active input and
  // commits each typed username to a chip.
  const [socials, setSocials] = useState<SocialHandle[]>([]);
  const [pillars, setPillars] = useState<string[]>([]);
  const [wantsPillarHelp, setWantsPillarHelp] = useState(false);
  const [inspoLinks, setInspoLinks] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const finish = async (links: string[]) => {
    if (saving) return;
    setSaving(true);
    try {
      await onComplete({
        socials: cleanSocials(socials),
        pillars,
        wantsPillarHelp,
        inspoLinks: clean(links),
      });
    } catch {
      setSaving(false); // let them retry; the overlay stays up
    }
  };

  const platformsFooter = (
    <div className="flex flex-col gap-2">
      <Button className="w-full" size="lg" onClick={() => setPhase("pillars")}>
        Continue
      </Button>
      <Button
        variant="ghost"
        className="text-muted-foreground w-full"
        onClick={() => setPhase("pillars")}
      >
        I&apos;ll add these later
      </Button>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={phase}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {phase === "welcome" && (
          <StepWelcome onStart={() => setPhase("socials")} />
        )}

        {phase === "socials" && (
          <StepPlatforms
            stepIndex={0}
            socials={socials}
            onChange={setSocials}
            onBack={() => setPhase("welcome")}
            footer={platformsFooter}
          />
        )}

        {phase === "pillars" && (
          <StepPillars
            stepIndex={1}
            pillars={pillars}
            onChangePillars={setPillars}
            wantsHelp={wantsPillarHelp}
            onChangeWantsHelp={setWantsPillarHelp}
            onBack={() => setPhase("socials")}
            onNext={() => setPhase("inspiration")}
            onSkip={() => setPhase("inspiration")}
          />
        )}

        {phase === "inspiration" && (
          <StepLinks
            stepIndex={2}
            title="Anything inspiring you right now?"
            subtitle="Totally optional. Paste links to creators or videos you love — we'll save them to your Inspiration library. You can always add these later."
            placeholder="Paste a creator or video link…"
            addLabel="Add another link"
            value={inspoLinks}
            onChange={setInspoLinks}
            onBack={() => setPhase("pillars")}
            onNext={() => void finish(inspoLinks)}
            onSkip={() => void finish([])}
            nextLabel={saving ? "Setting up…" : "Finish setup"}
            skipLabel="Finish, I'll do this later"
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
