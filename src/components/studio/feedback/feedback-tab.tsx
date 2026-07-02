"use client";

import { Show, SignInButton } from "@clerk/nextjs";
import { Loader2, Sparkles } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";
import { useAudioFeedback } from "@/hooks/use-audio-feedback";
import FeedbackResult from "@/components/studio/feedback/feedback-result";

const runBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-cyan-600 disabled:opacity-60";

export default function FeedbackTab() {
  const { source } = useStudio();
  const { status, data, error, run, reset } = useAudioFeedback(source?.url);
  const busy = status === "preparing" || status === "analyzing";

  if (!source || source.kind === "image") {
    return (
      <div className="p-4">
        <p className="text-foreground/55 text-sm leading-6">
          Add a recording to get AI feedback on your delivery.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {status === "done" && data ? (
          <div className="space-y-4">
            <FeedbackResult data={data} />
            <button
              type="button"
              onClick={reset}
              className="text-foreground/50 hover:text-foreground text-xs font-bold"
            >
              Analyze again
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-foreground text-sm font-black">
                AI delivery feedback
              </p>
              <p className="text-foreground/55 text-[13px] leading-5">
                Get coached on pace, fillers, pauses, clarity, and how your hook
                lands — scored, with punch-it-up rewrites.
              </p>
            </div>

            {busy ? (
              <div className="text-foreground/70 flex items-center gap-2 text-sm font-bold">
                <Loader2 className="h-4 w-4 animate-spin" />
                {status === "preparing"
                  ? "Preparing audio…"
                  : "Analyzing your delivery…"}
              </div>
            ) : (
              <>
                <Show when="signed-in">
                  <button
                    type="button"
                    onClick={() => void run()}
                    className={runBtn}
                  >
                    <Sparkles className="h-4 w-4" />
                    Get audio feedback · 1 credit
                  </button>
                </Show>
                <Show when="signed-out">
                  <SignInButton mode="modal" withSignUp>
                    <button type="button" className={runBtn}>
                      <Sparkles className="h-4 w-4" />
                      Sign in to get feedback
                    </button>
                  </SignInButton>
                </Show>
              </>
            )}

            {error === "insufficient_credits" && (
              <p className="text-sm font-bold text-amber-500">
                You&apos;re out of credits. Top up or upgrade to keep going.
              </p>
            )}
            {error === "no_speech" && (
              <p className="text-foreground/60 text-sm">
                No speech detected in this recording.
              </p>
            )}
            {error === "failed" && (
              <p className="text-sm font-bold text-red-500">
                Something went wrong — your credit wasn&apos;t charged. Try
                again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
