"use client";

import { TriangleAlert, X } from "lucide-react";
import { useStudio } from "@/components/studio/studio-context";

/**
 * A degraded 1-Click edit used to look identical to a successful one: the AI
 * retake pass would fail quietly and only the basic exact-repeat detector ran,
 * leaving most retakes in place with no indication anything went wrong. This
 * surfaces that failure instead of hiding it.
 */
export default function AiCleanupNotice() {
  const { aiCleanupUnavailable, dismissAiCleanupNotice } = useStudio();
  if (!aiCleanupUnavailable) return null;

  return (
    <div className="absolute top-3 left-1/2 z-40 w-[min(90%,420px)] -translate-x-1/2">
      <div className="border-border bg-card flex items-start gap-2.5 rounded-xl border p-3 shadow-xl">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-[13px] font-bold">
            AI cleanup unavailable
          </p>
          <p className="text-foreground/60 text-[11.5px] leading-4">
            Only basic exact-repeat detection ran, so some retakes may still be
            in the transcript. Review the transcript, or try again.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissAiCleanupNotice}
          aria-label="Dismiss"
          className="text-foreground/40 hover:text-foreground/70 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
