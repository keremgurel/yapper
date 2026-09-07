"use client";

import { Loader2 } from "lucide-react";
import type { ImportFailure, ImportProgress } from "@/hooks/use-sample-import";
import { sampleFailureCopy } from "@/lib/voice/failure-copy";

/** Where the sequential transcription is, and which videos did not make it. */
export default function ImportProgressNote({
  progress,
  failures,
  deriving,
}: {
  progress: ImportProgress | null;
  failures: ImportFailure[];
  deriving: boolean;
}) {
  if (!progress && failures.length === 0 && !deriving) return null;
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      {progress?.current ? (
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Listening to {progress.done + 1} of {progress.total}:{" "}
          {progress.current}
        </p>
      ) : null}
      {deriving ? (
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Writing your voice profile from what it heard…
        </p>
      ) : null}
      {failures.length > 0 ? (
        <ul className="text-destructive space-y-1 text-xs" role="alert">
          {failures.map((failure, index) => (
            <li key={`${failure.title}-${index}`}>
              {failure.title || "Untitled"}: {sampleFailureCopy(failure.code)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
