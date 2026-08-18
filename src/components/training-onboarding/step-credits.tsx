"use client";

import Link from "next/link";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useBillingStatus } from "@/hooks/use-billing-status";
import { TRAINING_FEEDBACK_CREDITS, WELCOME_CREDITS } from "@/lib/db/constants";

/**
 * The payoff screen. It renders the LIVE balance rather than the constant,
 * because the welcome grant is written by a webhook that can land after the
 * user gets here, and promising a number the balance does not yet show is the
 * fastest way to lose someone on their first minute.
 */
export default function StepCredits({ onDone }: { onDone: () => void }) {
  const { status, loading } = useBillingStatus();
  const balance = status?.balance ?? WELCOME_CREDITS;
  const feedbacks = Math.floor(balance / TRAINING_FEEDBACK_CREDITS);

  return (
    <div className="flex min-h-[540px] flex-col items-center justify-center p-6 text-center sm:p-8">
      <span className="bg-muted mb-5 grid h-14 w-14 place-items-center rounded-full">
        <Coins className="text-foreground/70 h-6 w-6" aria-hidden />
      </span>

      <h2 className="font-display text-foreground text-2xl font-bold tracking-tight">
        {loading ? "Setting up your credits" : `You have ${balance} credits`}
      </h2>

      <p className="text-muted-foreground mt-3 max-w-[36ch] text-sm leading-relaxed">
        {feedbacks >= 1
          ? `That covers ${feedbacks === 1 ? "your first coached rep" : `${feedbacks} coached reps`}. Record an answer and your coach will tell you how it landed, then show you the version you were reaching for.`
          : "Record an answer and your coach will tell you how it landed, then show you the version you were reaching for."}
      </p>

      <div className="mt-7 flex w-full flex-col gap-2">
        <Button size="lg" className="w-full" onClick={onDone}>
          Start practicing
        </Button>
        <Button asChild size="lg" variant="ghost" className="w-full">
          <Link href="/pricing" className="no-underline">
            See what a membership includes
          </Link>
        </Button>
      </div>
    </div>
  );
}
