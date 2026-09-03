"use client";

import { Loader2, Upload } from "lucide-react";
import type { AddVideoState } from "@/hooks/use-add-video";

/**
 * The first tile in the grid is where a new export goes. Same shape as a video
 * card so the grid reads as one set, sunken rather than bordered so it reads
 * as a place to put something rather than a thing already there.
 */
export default function UploadTile({
  state,
  progress,
  onAdd,
}: {
  state: AddVideoState;
  progress: number;
  onAdd: () => void;
}) {
  const busy = state === "uploading" || state === "preparing";
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={busy}
      className="bg-muted text-muted-foreground hover:text-foreground flex aspect-[9/16] w-full flex-col items-center justify-center gap-3 rounded-xl px-4 text-center transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none disabled:cursor-default"
    >
      <span className="bg-card grid h-10 w-10 place-items-center rounded-full">
        {busy ? (
          <Loader2
            aria-hidden
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <Upload aria-hidden className="h-4 w-4" />
        )}
      </span>
      <span className="text-foreground text-sm font-semibold">
        {state === "uploading"
          ? `Uploading ${Math.round(progress * 100)}%`
          : state === "preparing"
            ? "Reading the video"
            : "Add a finished video"}
      </span>
      <span className="text-xs">
        MP4 or MOV. Or drop it anywhere on this page.
      </span>
    </button>
  );
}
