"use client";
import { useCallback, useState } from "react";
import {
  crossPostToTikTok,
  crossPostToTikTokDirect,
} from "@/lib/publish/client";
import { useCrossPost } from "@/hooks/use-cross-post";
import TikTokPostReview, { type TikTokReview } from "../tiktok-post-review";
import ComposeActions from "./compose-actions";
import type { CrossPostTarget } from "./types";
export default function TikTokCompose({
  item,
  onDone,
}: {
  item: CrossPostTarget;
  onDone: () => void;
}) {
  const { state, error, errorDetail, result, post } = useCrossPost();
  const [review, setReview] = useState<TikTokReview | null>(null);
  const onReview = useCallback(
    (_id: string, next: TikTokReview) => setReview(next),
    [],
  );
  const onPost = () => {
    if (!review?.ready || state === "posting") return;
    void post((key) =>
      review.mode === "direct"
        ? crossPostToTikTokDirect(
            { ...item, caption: review.caption, settings: review.settings },
            key,
          )
        : crossPostToTikTok(item, key),
    );
  };
  return (
    <div className="space-y-4">
      <TikTokPostReview
        source={item}
        initialCaption={item.initialDescription ?? item.title}
        disabled={state !== "idle"}
        onChange={onReview}
      />
      <ComposeActions
        platform="tiktok"
        state={state}
        error={error}
        errorDetail={errorDetail}
        result={result}
        disabled={!review?.ready}
        postLabel={
          review?.mode === "inbox" ? "Send to TikTok inbox" : "Post to TikTok"
        }
        onPost={onPost}
        onDone={onDone}
      />
    </div>
  );
}
