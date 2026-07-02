"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Mic, Sparkles, Video } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { useFeedback, type FeedbackTier } from "@/hooks/use-audio-feedback";
import FeedbackResult from "@/components/studio/feedback/feedback-result";

const tierBtn =
  "flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 disabled:opacity-50";

const TIERS: {
  tier: FeedbackTier;
  icon: typeof Mic;
  label: string;
  desc: string;
  cost: number;
}[] = [
  {
    tier: "audio",
    icon: Mic,
    label: "Audio feedback",
    desc: "Pace, fillers, pauses, clarity",
    cost: 1,
  },
  {
    tier: "video",
    icon: Video,
    label: "Video feedback",
    desc: "On-camera presence & energy",
    cost: 2,
  },
  {
    tier: "full",
    icon: Sparkles,
    label: "Full feedback",
    desc: "Delivery + on-camera, combined",
    cost: 3,
  },
];

export default function FeedbackTab() {
  const { source } = useStudio();
  const { status, data, error, run, reset } = useFeedback(source?.url);
  const busy =
    status === "preparing" || status === "uploading" || status === "analyzing";
  const hasVideo = !!source && source.kind !== "image";

  if (!source || source.kind === "image") {
    return (
      <div className="p-4">
        <p className="text-foreground/55 text-sm leading-6">
          Add a recording to get AI feedback on your delivery.
        </p>
      </div>
    );
  }

  const busyLabel =
    status === "uploading"
      ? "Uploading your video…"
      : status === "preparing"
        ? "Preparing…"
        : "Analyzing your delivery…";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {status === "done" && data ? (
          <div className="space-y-4">
            <FeedbackResult coaching={data.coaching} metrics={data.metrics} />
            <button
              type="button"
              onClick={reset}
              className="text-foreground/50 hover:text-foreground text-xs font-bold"
            >
              Analyze again
            </button>
          </div>
        ) : busy ? (
          <div className="text-foreground/70 flex items-center gap-2 text-sm font-bold">
            <Loader2 className="h-4 w-4 animate-spin" />
            {busyLabel}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-foreground text-sm font-black">
                AI delivery feedback
              </p>
              <p className="text-foreground/55 text-[13px] leading-5">
                Get coached, scored, with punch-it-up rewrites. Pick how deep to
                go.
              </p>
            </div>

            <Show when="signed-in">
              <div className="space-y-2">
                {TIERS.map(({ tier, icon: Icon, label, desc, cost }) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => void run(tier)}
                    disabled={!hasVideo && tier !== "audio"}
                    className={tierBtn}
                  >
                    <span className="border-border bg-muted text-foreground/70 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block text-[13px] font-bold">
                        {label}
                      </span>
                      <span className="text-foreground/50 block text-[11px]">
                        {desc}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-bold text-cyan-500">
                      {cost} cr
                    </span>
                  </button>
                ))}
              </div>
            </Show>
            <Show when="signed-out">
              <SignInButton mode="modal" withSignUp>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-cyan-600"
                >
                  <Sparkles className="h-4 w-4" />
                  Sign in to get feedback
                </button>
              </SignInButton>
            </Show>

            {error === "not_entitled" && (
              <a
                href="/pricing"
                className="block text-sm font-bold text-cyan-500 hover:underline"
              >
                Subscribe to unlock AI feedback (7-day free trial).
              </a>
            )}
            {error === "insufficient_credits" && (
              <p className="text-sm font-bold text-amber-500">
                You&apos;re out of credits. Top up or upgrade to keep going.
              </p>
            )}
            {error === "storage_full" && (
              <p className="text-sm font-bold text-amber-500">
                You&apos;re out of storage. Delete old sessions or upgrade.
              </p>
            )}
            {error === "no_speech" && (
              <p className="text-foreground/60 text-sm">
                No speech detected in this recording.
              </p>
            )}
            {error === "failed" && (
              <p className="text-sm font-bold text-red-500">
                Something went wrong, your credit wasn&apos;t charged. Try
                again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
