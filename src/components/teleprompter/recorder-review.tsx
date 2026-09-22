"use client";

import Link from "next/link";
import { studioEditorUrl } from "@/lib/studio/editor-handoff";
import { Check, Download, Library, Loader2, RotateCcw } from "lucide-react";
import { recordingFileName } from "@/lib/studio/recording-file";
import { useSaveTake } from "@/hooks/use-save-take";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** After a take: play it back, then retake, save, or download.
 * When the take was recorded for a Content Library item, "Save to library"
 * uploads it and links it on that item (durable, editable later). */
export default function RecorderReview({
  url,
  blob,
  itemId = null,
  title,
  onRetake,
}: {
  url: string;
  blob: Blob;
  itemId?: string | null;
  title?: string;
  onRetake: () => void;
}) {
  const { state, error, save, savedItemId } = useSaveTake(itemId);

  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = recordingFileName(
      `yapper-take-${new Date().toISOString().slice(0, 19)}`,
      blob.type,
    );
    a.click();
  };

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <video
        src={url}
        controls
        playsInline
        className="mb-5 w-full rounded-2xl bg-black"
      />
      <div className="space-y-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={() => void save(blob, title)}
          disabled={state === "saving" || state === "saved"}
        >
          {state === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Library className="h-4 w-4" />
          )}
          {state === "saving"
            ? "Saving to library…"
            : state === "saved"
              ? "Saved to library"
              : "Save to library"}
        </Button>
        {state === "saved" && savedItemId && (
          <Link
            href={studioEditorUrl(savedItemId)}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full no-underline",
            )}
          >
            Edit this recording on Mac
          </Link>
        )}
        {state === "saved" && savedItemId && (
          <Link
            href={`/studio/library/${savedItemId}`}
            className="text-foreground/60 hover:text-foreground block text-center text-xs font-bold no-underline"
          >
            Open it in the library
          </Link>
        )}
        {state === "error" && (
          <p
            role="alert"
            className="text-center text-xs font-bold text-red-500"
          >
            {error === "storage_full"
              ? "You're out of storage. Delete old sessions or upgrade."
              : error === "locked"
                ? "Saving recordings needs a subscription."
                : error === "too_large"
                  ? "This take exceeds the upload limit. Download it to keep a copy and shorten it before uploading."
                  : error === "unavailable"
                    ? "Cloud storage is unavailable. Your take is still here; download it or try saving again later."
                    : "Could not save the take. It's still here; try again."}
          </p>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={onRetake}
            disabled={state === "saving"}
          >
            <RotateCcw className="h-4 w-4" />
            Retake
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={download}
          >
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}
