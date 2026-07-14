"use client";

import { crossPostToTikTok } from "@/lib/publish/client";
import { useCrossPost } from "@/hooks/use-cross-post";
import ComposeActions from "./compose-actions";
import type { CrossPostTarget } from "./types";

/** Compose a TikTok post: there's nothing to write here. Until the app passes
 * TikTok's direct-post audit, we send the video to the user's TikTok drafts and
 * they add the caption and publish in the app. */
export default function TikTokCompose({
  item,
  onDone,
}: {
  item: CrossPostTarget;
  onDone: () => void;
}) {
  const { state, error, result, post } = useCrossPost();
  const busy = state === "posting";

  const onPost = () => {
    if (busy) return;
    void post(() =>
      crossPostToTikTok({
        submissionId: item.submissionId,
        contentItemId: item.id,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-xs">
        We send the video to your TikTok drafts. You add the caption and publish
        it in the TikTok app, where it shows up in your notifications.
      </p>

      <ComposeActions
        platform="tiktok"
        state={state}
        error={error}
        result={result}
        postLabel="Send to TikTok drafts"
        onPost={onPost}
        onDone={onDone}
      />
    </div>
  );
}
