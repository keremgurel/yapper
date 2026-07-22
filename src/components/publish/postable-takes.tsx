"use client";

import { useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, Send, Upload } from "lucide-react";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import { useContentList } from "@/hooks/use-content-list";
import { useAddVideo, type AddVideoError } from "@/hooks/use-add-video";
import { postableVideos } from "@/lib/publish/postable-videos";

function when(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function uploadErrorText(e: AddVideoError): string {
  switch (e) {
    case "not_video":
      return "That file is not a video.";
    case "storage_full":
      return "Your storage is full. Delete something or upgrade to add more.";
    case "locked":
      return "Sign in to upload a video.";
    default:
      return "Upload failed. Please try again.";
  }
}

/**
 * The finished videos you can post, right on the Poster page: every library
 * item with a recorded or uploaded take behind it, newest first, each with a
 * button that opens the cross-post sheet. Two ways in: a take recorded here, or
 * a video edited elsewhere brought in with Upload.
 */
export default function PostableTakes() {
  const { isSignedIn } = useUser();
  const { items, refresh } = useContentList(!!isSignedIn);
  const [target, setTarget] = useState<CrossPostTarget | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Reload the list once the upload registers, so the new video appears here.
  const {
    state: uploadState,
    error: uploadError,
    add,
  } = useAddVideo(() => refresh());

  const videos = postableVideos(items);
  const uploading = uploadState === "uploading";

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-foreground text-lg font-black tracking-tight">
          Ready to post
        </h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !isSignedIn}
          className="border-border text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-black transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          {uploading ? "Uploading…" : "Upload video"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void add(file);
            e.target.value = "";
          }}
        />
      </div>

      {uploadError && (
        <p className="text-destructive mt-2 text-xs font-bold">
          {uploadErrorText(uploadError)}
        </p>
      )}

      {items === null ? (
        <div className="text-muted-foreground mt-3 flex items-center gap-2 py-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your videos…
        </div>
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground border-border mt-3 rounded-xl border border-dashed py-8 text-center text-sm">
          Record a video, or upload one edited elsewhere, to cross-post it here.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {videos.map((v) => (
            <li
              key={v.id}
              className="border-border bg-card flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-bold">
                  {v.title}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  Edited {when(v.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setTarget({
                    id: v.id,
                    title: v.title,
                    submissionId: v.submissionId,
                    contentItemId: v.id,
                  })
                }
                className="bg-foreground text-background inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-black transition-opacity hover:opacity-90"
              >
                <Send className="h-3.5 w-3.5" />
                Post
              </button>
            </li>
          ))}
        </ul>
      )}

      {target && (
        <CrossPostSheet
          key={target.id}
          item={target}
          onClose={() => setTarget(null)}
        />
      )}
    </section>
  );
}
