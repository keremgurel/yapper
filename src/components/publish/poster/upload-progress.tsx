"use client";

import { Loader2, UploadCloud } from "lucide-react";
import type {
  AddVideoError,
  AddVideoNotice,
  AddVideoState,
} from "@/hooks/use-add-video";
import { uploadErrorText } from "@/components/publish/poster/upload-error";

/** What is happening to the file the creator just added, and only while it is. */
export default function UploadProgress({
  state,
  progress,
  error,
  notice,
}: {
  state: AddVideoState;
  progress: number;
  error: AddVideoError | null;
  notice: AddVideoNotice | null;
}) {
  const uploading = state === "uploading";
  const preparing = state === "preparing";

  if (error) {
    return (
      <p
        role="alert"
        className="text-sm font-semibold text-[color:var(--sg-yellow-500)]"
      >
        {uploadErrorText(error)}
      </p>
    );
  }

  if (uploading || preparing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="border-border bg-card overflow-hidden rounded-xl border"
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {uploading ? (
            <UploadCloud className="h-4 w-4 text-[color:var(--sg-accent)]" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--sg-accent)] motion-reduce:animate-none" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-semibold">
              {uploading
                ? `Uploading the final export, ${Math.round(progress * 100)}%`
                : "Reading the video for captions"}
            </p>
            <p className="text-muted-foreground text-xs">
              {uploading
                ? "The video opens here as soon as it lands."
                : "The transcript grounds every platform draft."}
            </p>
          </div>
        </div>
        <div className="bg-muted h-1">
          <div
            className="h-full bg-[color:var(--sg-accent)] transition-[width] duration-200"
            style={{ width: `${uploading ? progress * 100 : 100}%` }}
          />
        </div>
      </div>
    );
  }

  if (notice === "transcript_failed") {
    return (
      <p className="text-sm text-[color:var(--sg-yellow-500)]">
        The video uploaded, but its transcript could not be prepared. Captions
        will use the title and your prompt.
      </p>
    );
  }

  return null;
}
