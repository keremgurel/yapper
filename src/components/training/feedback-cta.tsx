"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Sparkles } from "lucide-react";

import OnboardingOverlay from "@/components/onboarding/onboarding-overlay";
import TrainingOnboardingFlow from "@/components/training-onboarding/training-onboarding-flow";
import { Button } from "@/components/ui/button";
import { useTrainingFeedback } from "@/hooks/use-training-feedback";
import { useTrainingOnboarding } from "@/hooks/use-training-onboarding";
import { TRAINING_FEEDBACK_CREDITS } from "@/lib/db/constants";
import type { TrainingContext } from "@/lib/training-feedback/types";
import type { TrainingFeedbackError } from "@/hooks/use-training-feedback";

const MESSAGES: Record<TrainingFeedbackError, string> = {
  unauthorized: "Sign in to get feedback on this rep.",
  not_entitled: "Feedback needs a membership. The free trial covers it.",
  insufficient_credits: "You are out of credits.",
  too_short: "That rep was too short to coach. Try saying a bit more.",
  rate_limited: "Too many reps in a row. Give it a minute.",
  no_provider: "Coaching is temporarily unavailable. Try again shortly.",
  unknown: "Could not get feedback. Try again.",
};

/** Whether the failure is fixed by paying rather than by retrying. */
const BUY_CREDITS: TrainingFeedbackError[] = [
  "not_entitled",
  "insufficient_credits",
];

/**
 * Turns a finished rep into a coached one. Sits on the completion screen, so
 * it has to work for a signed-out visitor who has never seen the product:
 * signed-out gets a sign-in modal rather than a dead button, and the credit
 * cost is stated up front rather than discovered by a 402.
 */
export default function TrainingFeedbackCta({
  audio,
  audioPending,
  context,
}: {
  audio: Blob | null;
  /** The audio copy is still being assembled; do not call the mic missing. */
  audioPending: boolean;
  context: TrainingContext;
}) {
  const router = useRouter();
  const { state, error, run } = useTrainingFeedback();
  const { isLoaded, onboarded, goals, complete } = useTrainingOnboarding();
  const [navigating, setNavigating] = useState(false);
  const [settingUp, setSettingUp] = useState(false);

  // Read inside the async send() to tell "still the same rep" from "they moved
  // on"; refs rather than state so the check sees the current value, not the
  // one captured when the request started.
  const mountedRef = useRef(true);
  const audioRef = useRef(audio);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const busy = state === "running" || navigating;

  const send = async (withGoals: string[]) => {
    if (!audio) return;
    const sent = audio;
    const result = await run(sent, { ...context, goals: withGoals });
    if (!result) return;
    // Coaching takes about half a minute, and the user is free to start
    // another rep while it runs. Navigating on a stale result would throw away
    // the take they are in the middle of, so only follow through if this is
    // still the rep on screen and the screen is still mounted. The credit was
    // already spent legitimately and the report stays reachable from /progress.
    if (!mountedRef.current || audioRef.current !== sent) return;
    setNavigating(true);
    router.push(`/progress/${result.submissionId}`);
  };

  /**
   * The setup flow deliberately never opens itself on a practice page: a modal
   * over a running timer would destroy the take. This is the moment it is safe
   * and useful to ask, because what someone is practicing for decides the
   * register their answer gets judged against. Every step is skippable.
   */
  const submit = () => {
    if (!audio || busy) return;
    if (isLoaded && !onboarded) {
      setSettingUp(true);
      return;
    }
    void send(goals);
  };

  if (!audio) {
    return (
      <p className="text-center text-[13px] text-white/45">
        {audioPending
          ? "Getting your rep ready…"
          : "Turn on your mic before a rep to get AI feedback on it."}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {settingUp && (
        <OnboardingOverlay
          onClose={() => setSettingUp(false)}
          label="Get set up"
        >
          <TrainingOnboardingFlow
            initialName=""
            onComplete={complete}
            onDone={(collected) => {
              setSettingUp(false);
              void send(collected);
            }}
          />
        </OnboardingOverlay>
      )}

      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button type="button" size="lg" variant="contrast">
            <Sparkles className="h-4 w-4" />
            Sign in for AI feedback
          </Button>
        </SignInButton>
      </Show>

      <Show when="signed-in">
        <Button
          type="button"
          size="lg"
          variant="contrast"
          onClick={submit}
          disabled={busy}
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Coaching your rep…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Get AI feedback ({TRAINING_FEEDBACK_CREDITS} credits)
            </>
          )}
        </Button>
      </Show>

      {busy && (
        <p className="text-[12px] text-white/45">
          Transcribing and scoring. This takes about half a minute.
        </p>
      )}

      {error && !busy && (
        <p role="alert" className="text-center text-[13px] text-white/70">
          {MESSAGES[error]}{" "}
          {BUY_CREDITS.includes(error) && (
            <Link href="/pricing" className="underline">
              See plans
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
