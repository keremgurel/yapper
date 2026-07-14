"use client";

import { ExternalLink, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { PublishPlatform } from "@/lib/db/schema";
import type { CrossPostError, CrossPostState } from "@/hooks/use-cross-post";
import type { CrossPostResult } from "@/lib/publish/client";
import ProfessionalAccountHelp from "./professional-account-help";

const ERROR_COPY: Record<CrossPostError, string> = {
  not_connected: "Connect this platform first, from Connections.",
  not_professional: "Your Instagram needs to be a Professional account",
  failed: "Couldn't post. Try again.",
};

/**
 * The shared footer of every compose body: the error line, the success view
 * (a link when the post is live, or a drafts note), and the primary post
 * button. Each body owns its own fields and hands this its post state.
 */
export default function ComposeActions({
  platform,
  state,
  error,
  result,
  postLabel,
  postedSuffix,
  onPost,
  onDone,
  disabled,
}: {
  platform: PublishPlatform;
  state: CrossPostState;
  error: CrossPostError | null;
  result: CrossPostResult | null;
  postLabel: string;
  postedSuffix?: string;
  onPost: () => void;
  onDone: () => void;
  disabled?: boolean;
}) {
  const busy = state === "posting";
  const label = PLATFORMS[platform].label;

  if (state === "done" && result) {
    return (
      <div className="flex flex-col gap-3">
        {result.draft ? (
          <p className="text-sm font-bold text-[color:var(--sg-green-500)]">
            Sent to your {label} drafts. Open the app to finish posting.
          </p>
        ) : (
          <>
            <p className="text-sm font-bold text-[color:var(--sg-green-500)]">
              Posted to {label}
              {postedSuffix ? ` ${postedSuffix}` : ""}.
            </p>
            {result.url && (
              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="text-foreground flex items-center gap-1.5 text-sm font-bold hover:text-[color:var(--sg-accent)]"
              >
                <ExternalLink className="h-4 w-4" />
                View on {label}
              </a>
            )}
          </>
        )}
        <Button type="button" variant="outline" onClick={onDone}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error === "not_professional" ? (
        <div className="border-border rounded-lg border border-[color:var(--sg-pink-500)]/40 bg-[color:var(--sg-pink-500)]/5 p-3">
          <p className="text-sm font-bold text-[color:var(--sg-pink-500)]">
            {ERROR_COPY.not_professional}
          </p>
          <div className="mt-2">
            <ProfessionalAccountHelp />
          </div>
        </div>
      ) : (
        error && (
          <p className="text-sm font-bold text-[color:var(--sg-pink-500)]">
            {ERROR_COPY[error]}
          </p>
        )
      )}
      <Button
        type="button"
        onClick={onPost}
        disabled={disabled || busy}
        style={{ background: "var(--sg-accent-gradient)" }}
        className="text-white"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {busy ? "Posting…" : postLabel}
      </Button>
    </div>
  );
}
