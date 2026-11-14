"use client";
import { useCallback, useState } from "react";
import {
  crossPostToTikTok,
  crossPostToTikTokDirect,
} from "@/lib/publish/client";
import { useCrossPost } from "@/hooks/use-cross-post";
import PostingDeclaration from "../sheet/posting-declaration";
import TikTokPostReview from "../tiktok-post-review";
import { tiktokDirectPost, type TikTokReview } from "../tiktok/tiktok-review";
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
  const [consentedTo, setConsentedTo] = useState<"standard" | "branded" | null>(
    null,
  );
  const direct = review?.mode !== "inbox";
  const declaration = review?.settings?.brandedContent ? "branded" : "standard";
  const consent = consentedTo === declaration;
  const ready = Boolean(review?.ready) && (!direct || consent);
  const onReview = useCallback(
    (_id: string, next: TikTokReview) => setReview(next),
    [],
  );
  const onPost = () => {
    if (!review || !ready || state === "posting") return;
    void post(async (key) => {
      const body = tiktokDirectPost(review, consent, item.coverTimestampMs);
      return body
        ? crossPostToTikTokDirect({ ...item, ...body }, key)
        : crossPostToTikTok(item, key);
    });
  };
  return (
    <div className="space-y-4">
      <TikTokPostReview
        source={item}
        initialCaption={item.initialDescription ?? item.title}
        disabled={state !== "idle"}
        onChange={onReview}
      />
      {direct && (
        <PostingDeclaration
          checked={consent}
          onChange={(checked) => setConsentedTo(checked ? declaration : null)}
          disabled={state !== "idle"}
          branded={declaration === "branded"}
          videos={1}
        />
      )}
      <ComposeActions
        platform="tiktok"
        state={state}
        error={error}
        errorDetail={errorDetail}
        result={result}
        disabled={!ready}
        postLabel={
          review?.mode === "inbox" ? "Send to TikTok inbox" : "Post to TikTok"
        }
        onPost={onPost}
        onDone={onDone}
      />
    </div>
  );
}
