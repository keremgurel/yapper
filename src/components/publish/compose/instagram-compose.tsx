"use client";

import { useState } from "react";
import { crossPostToInstagram } from "@/lib/publish/client";
import { useCrossPost } from "@/hooks/use-cross-post";
import ComposeActions from "./compose-actions";
import type { CrossPostTarget } from "./types";

/** Compose an Instagram Reel: one caption. Instagram pulls the video and posts
 * it directly, but only for a Business or Creator account. */
export default function InstagramCompose({
  item,
  onDone,
}: {
  item: CrossPostTarget;
  onDone: () => void;
}) {
  const [caption, setCaption] = useState("");
  const { state, error, result, post } = useCrossPost();
  const busy = state === "posting";

  const onPost = () => {
    if (busy) return;
    void post(() =>
      crossPostToInstagram({
        submissionId: item.submissionId,
        caption: caption.trim() || undefined,
        contentItemId: item.id,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        Posts a Reel to your Instagram. Needs a Business or Creator account
        (switching is free in the Instagram app).
      </p>

      <label className="flex flex-col gap-1.5">
        <span className="text-foreground/70 text-xs font-bold">Caption</span>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2200}
          rows={6}
          disabled={busy}
          placeholder="Write a caption. Hashtags welcome."
          className="border-border bg-card placeholder:text-foreground/30 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-[color:var(--sg-accent)]"
        />
        <span className="text-muted-foreground text-[11px]">
          {caption.length}/2200
        </span>
      </label>

      <ComposeActions
        platform="instagram"
        state={state}
        error={error}
        result={result}
        postLabel="Post Reel"
        onPost={onPost}
        onDone={onDone}
      />
    </div>
  );
}
