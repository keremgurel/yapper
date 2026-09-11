"use client";

import { publishErrorCopy } from "@/lib/publish/error-copy";
import AddToVoiceButton from "@/components/brain/voice/add-to-voice-button";
import { ExternalLink } from "lucide-react";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { CrossPostOutcome } from "@/lib/publish/run-cross-post";

export interface SourceOutcome extends CrossPostOutcome {
  sourceId: string;
  sourceTitle: string;
}

const STATUS_LABEL: Record<CrossPostOutcome["status"], string> = {
  posted: "Posted",
  draft: "Delivered to TikTok inbox",
  pending: "Awaiting confirmation",
  failed: "Failed",
};

/** What happened, per video and per destination. Failures stay on screen
 * beside successes: the fan-out isolates them, so the result is genuinely
 * mixed and summarising it as one state would be a lie. */
export default function OutcomeList({
  outcomes,
}: {
  outcomes: SourceOutcome[];
}) {
  if (outcomes.length === 0) return null;

  return (
    <div className="divide-border/60 border-border flex flex-col divide-y rounded-xl border">
      {outcomes.map((outcome) => (
        <div
          key={`${outcome.sourceId}-${outcome.platform}`}
          className="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="text-foreground truncate text-[13px] font-medium">
              {outcome.sourceTitle}
            </p>
            <p className="text-muted-foreground text-xs">
              {PLATFORMS[outcome.platform].label}
            </p>
            {outcome.error && (
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                {publishErrorCopy(outcome.error)}
              </p>
            )}
            {outcome.status === "draft" && (
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Open TikTok → Inbox and tap “Your content from Yapper is ready”
                to finish posting.
              </p>
            )}
          </div>
          {outcome.url ? (
            <span className="flex items-center gap-3">
              <AddToVoiceButton
                platform={outcome.platform}
                url={outcome.url}
                title={outcome.sourceTitle}
              />
              <a
                href={outcome.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs font-semibold text-[color:var(--sg-accent)]"
              >
                Posted <ExternalLink aria-hidden className="h-3 w-3" />
              </a>
            </span>
          ) : (
            <span
              className={`text-xs font-semibold ${
                outcome.status === "failed"
                  ? "text-[color:var(--sg-pink-500)]"
                  : outcome.status === "pending"
                    ? "text-muted-foreground"
                    : "text-[color:var(--sg-green-500)]"
              }`}
            >
              {STATUS_LABEL[outcome.status]}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
