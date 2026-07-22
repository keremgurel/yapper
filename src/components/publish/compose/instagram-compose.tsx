"use client";

import { useState } from "react";
import { crossPostToInstagram } from "@/lib/publish/client";
import { useCrossPost } from "@/hooks/use-cross-post";
import { useThumbnailUpload } from "@/hooks/use-thumbnail-upload";
import ComposeActions from "./compose-actions";
import ProfessionalAccountHelp from "./professional-account-help";
import ThumbnailPicker from "./thumbnail-picker";
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
  const thumb = useThumbnailUpload();

  const onPost = () => {
    if (busy) return;
    void post(() =>
      crossPostToInstagram({
        submissionId: item.submissionId,
        mediaKey: item.mediaKey,
        caption: caption.trim() || undefined,
        contentItemId: item.contentItemId,
        thumbnailKey: thumb.thumbnailKey ?? undefined,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-muted-foreground text-xs">
        <p>Posts a Reel to your Instagram.</p>
        <details className="mt-1">
          <summary className="cursor-pointer font-bold text-[color:var(--sg-accent)] hover:opacity-80">
            Needs a Business or Creator account. How do I switch?
          </summary>
          <div className="mt-2">
            <ProfessionalAccountHelp />
          </div>
        </details>
      </div>

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

      <ThumbnailPicker
        previewUrl={thumb.previewUrl}
        uploading={thumb.uploading}
        error={thumb.error}
        onPick={thumb.pick}
        onClear={thumb.clear}
      />

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
