"use client";

import { Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Where a finished export goes. The whole band is one button, so a click
 * anywhere opens the file picker, and it lights up while a file is dragged
 * over the page because a drop anywhere on the step lands here.
 */
export default function UploadDropZone({
  dragging,
  busy,
  onChoose,
}: {
  dragging: boolean;
  busy: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={busy}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-[1.5px] border-dashed px-4 py-4 text-left transition-colors duration-[var(--sg-dur-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent)] disabled:cursor-default disabled:opacity-60 motion-reduce:transition-none sm:px-6 sm:py-6",
        dragging
          ? "bg-card border-[color:var(--sg-accent)]"
          : "bg-muted hover:bg-card border-[color:var(--sg-border-strong)]",
      )}
    >
      <span className="bg-card grid size-12 shrink-0 place-items-center rounded-full">
        <Upload
          aria-hidden
          className={cn(
            "size-5",
            dragging
              ? "text-[color:var(--sg-accent)]"
              : "text-muted-foreground",
          )}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block text-[15px] font-semibold">
          {dragging ? (
            "Drop to upload"
          ) : busy ? (
            "Uploading your video…"
          ) : (
            <>
              <span className="pointer-coarse:hidden">Drop a video here</span>
              <span className="hidden pointer-coarse:inline">
                Upload a video
              </span>
            </>
          )}
        </span>
        <span className="text-muted-foreground mt-1 block text-[13px]">
          MP4 or MOV. It opens ready to post.
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "pointer-events-none hidden sm:inline-flex",
        )}
      >
        Choose a file
      </span>
    </button>
  );
}
