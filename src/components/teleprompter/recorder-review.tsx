"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Download,
  Library,
  Loader2,
  RotateCcw,
  Scissors,
} from "lucide-react";
import { setPendingVideo } from "@/lib/studio/handoff";
import { recordingFileName } from "@/lib/studio/recording-file";
import { useSaveTake } from "@/hooks/use-save-take";

/** After a take: play it back, then retake, edit in the studio, or download.
 * "Edit this take" hands the blob to the editor via the in-memory handoff.
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
  const router = useRouter();
  const { state, error, save } = useSaveTake(itemId);

  const edit = () => {
    setPendingVideo(blob);
    router.push("/studio/editor");
  };

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
        {itemId && (
          <button
            type="button"
            onClick={() => void save(blob, title)}
            disabled={state === "saving" || state === "saved"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-cyan-600 disabled:opacity-60"
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
          </button>
        )}
        {state === "saved" && itemId && (
          <Link
            href={`/studio/library/${itemId}`}
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
                : "Could not save the take. It's still here; try again."}
          </p>
        )}

        <button
          type="button"
          onClick={edit}
          className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black transition-colors ${
            itemId
              ? "border-border hover:bg-muted/40 border"
              : "bg-cyan-500 text-white hover:bg-cyan-600"
          }`}
        >
          <Scissors className="h-4 w-4" />
          Edit this take
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRetake}
            className="border-border hover:bg-muted/40 flex flex-1 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Retake
          </button>
          <button
            type="button"
            onClick={download}
            className="border-border hover:bg-muted/40 flex flex-1 items-center justify-center gap-2 rounded-full border px-5 py-3 text-sm font-bold transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
