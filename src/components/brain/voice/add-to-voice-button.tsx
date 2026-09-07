"use client";

import { useState } from "react";
import { Check, Loader2, Mic } from "lucide-react";
import type { PublishPlatform } from "@/lib/db/schema";
import { addVoiceSample, VoiceRequestError } from "@/lib/voice/client";
import { sampleFailureCopy } from "@/lib/voice/failure-copy";
import { sampleIdFromUrl } from "@/lib/voice/sample-id";

/**
 * Learn from what I post: offers a video that just went live into the voice
 * set. One credit per three minutes, like any other sample; YouTube free.
 */
export default function AddToVoiceButton({
  platform,
  url,
  title,
}: {
  platform: PublishPlatform;
  url: string;
  title: string;
}) {
  const [state, setState] = useState<"idle" | "adding" | "added" | "failed">(
    "idle",
  );
  const [failure, setFailure] = useState<string | null>(null);

  const add = async () => {
    if (state === "adding" || state === "added") return;
    setState("adding");
    setFailure(null);
    try {
      await addVoiceSample(platform, {
        id: sampleIdFromUrl(platform, url),
        url,
        title,
        thumbnail: null,
        viewCount: 0,
        publishedAt: new Date().toISOString(),
        privacyStatus: "public",
        durationSec: null,
      });
      setState("added");
    } catch (error) {
      setFailure(
        sampleFailureCopy(
          error instanceof VoiceRequestError ? error.code : "failed",
        ),
      );
      setState("failed");
    }
  };

  if (state === "added") {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Check className="h-3 w-3" aria-hidden="true" /> In your voice
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={() => void add()}
        disabled={state === "adding"}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-semibold disabled:opacity-60"
      >
        {state === "adding" ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        ) : (
          <Mic className="h-3 w-3" aria-hidden="true" />
        )}
        {state === "adding" ? "Listening…" : "Add to your voice"}
      </button>
      {failure ? (
        <span
          className="text-destructive max-w-[28ch] text-right text-[11px]"
          role="alert"
        >
          {failure}
        </span>
      ) : null}
    </span>
  );
}
