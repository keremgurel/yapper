"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, Send } from "lucide-react";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import { useContentList } from "@/hooks/use-content-list";
import { postableVideos } from "@/lib/publish/postable-videos";

function when(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * The finished takes you can post, right on the Poster page: every library item
 * with a recorded take behind it, newest first, each with a button that opens
 * the cross-post sheet. This is the "recorded and edited here, now send it out"
 * entry point. Uploading a video edited elsewhere comes next.
 */
export default function PostableTakes() {
  const { isSignedIn } = useUser();
  const { items } = useContentList(!!isSignedIn);
  const [target, setTarget] = useState<CrossPostTarget | null>(null);

  const videos = postableVideos(items);

  return (
    <section>
      <h2 className="font-display text-foreground text-lg font-black tracking-tight">
        Ready to post
      </h2>
      {items === null ? (
        <div className="text-muted-foreground mt-3 flex items-center gap-2 py-8 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your videos…
        </div>
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground border-border mt-3 rounded-xl border border-dashed py-8 text-center text-sm">
          Record and edit a video, then it shows up here to cross-post.
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
