"use client";

import { useEffect, useMemo, useState } from "react";
import { beginConnect } from "@/lib/publish/begin-connect";
import { publishErrorCopy } from "@/lib/publish/error-copy";
import {
  defaultTikTokChoices,
  type TikTokPostChoices,
} from "@/lib/publish/tiktok-direct-defaults";
import { validateTikTokDirectSettings } from "@/lib/publish/tiktok-direct-settings";
import type { CrossPostTarget } from "./compose/types";
import TikTokDirectFields from "./tiktok/tiktok-direct-fields";
import { settingsSelect } from "./tiktok/tiktok-field-styles";
import { tiktokAudience, type TikTokReview } from "./tiktok/tiktok-review";
import { usePublishPreview } from "./tiktok/use-publish-preview";
import { useTikTokCreator } from "./tiktok/use-tiktok-creator";

export { tiktokAudience, type TikTokReview } from "./tiktok/tiktok-review";

type Mode = TikTokReview["mode"];

/**
 * TikTok's choices for one video: how it is delivered and, for a Direct Post,
 * the audience, interactions and labels. The choices start filled in from the
 * creator's account. Posting consent is not here: the sheet asks for it once,
 * beside the publish button.
 *
 * `compact` is the Poster, where the video and its caption are already on the
 * page, so neither is repeated.
 */
export default function TikTokPostReview({
  source,
  initialCaption,
  disabled,
  onChange,
  compact = false,
}: {
  compact?: boolean;
  source: CrossPostTarget;
  initialCaption: string;
  disabled: boolean;
  onChange: (id: string, review: TikTokReview) => void;
}) {
  const [mode, setMode] = useState<Mode>("direct");
  const [editedCaption, setCaption] = useState<string | null>(null);
  const caption = compact ? initialCaption : (editedCaption ?? initialCaption);
  const { context, error } = useTikTokCreator();
  const { preview, failed: previewFailed } = usePublishPreview(
    source.submissionId,
    source.mediaKey,
  );
  const [edited, setEdited] = useState<TikTokPostChoices | null>(null);
  // Edits belong to the account they were made for; a different account
  // starts from its own defaults.
  const settings = useMemo(
    () =>
      !context
        ? null
        : edited?.accountId === context.accountId
          ? edited
          : defaultTikTokChoices(
              context.creator,
              context.audited,
              context.accountId,
            ),
    [context, edited],
  );
  const invalid =
    context && preview && settings
      ? validateTikTokDirectSettings(
          { ...settings, consent: true },
          context.creator,
          preview.duration,
          context.audited,
        )
      : "not_ready";
  const ready =
    !!preview && (mode === "inbox" || (!invalid && caption.length <= 2200));
  const loading =
    (!preview && !previewFailed) || (mode === "direct" && !context && !error);

  const { id } = source;
  useEffect(() => {
    onChange(id, { mode, caption, settings, ready, loading });
  }, [id, mode, caption, settings, ready, loading, onChange]);

  const body = (
    <div className="space-y-3">
      <label className="flex flex-col gap-2">
        Posting method
        <select
          className={settingsSelect}
          value={mode}
          onChange={(event) => setMode(event.target.value as Mode)}
        >
          <option value="direct">Post to TikTok</option>
          <option value="inbox">Send to TikTok inbox to finish there</option>
        </select>
      </label>
      {mode === "inbox" ? (
        <p className="text-muted-foreground text-xs">
          We’ll confirm inbox delivery. Open “Your content from Yapper is ready”
          in TikTok to add the caption and finish posting.
        </p>
      ) : context && settings ? (
        <>
          <p>
            Posting as <strong>{context.creator.creator_nickname}</strong> (@
            {context.creator.creator_username})
          </p>
          {!context.audited && (
            <p className="text-muted-foreground text-xs">
              TikTok’s review is pending. Test posts must use “Only me” and a
              private TikTok account. Public posting becomes available after
              approval.
            </p>
          )}
          {!compact && (
            <label className="flex flex-col gap-2">
              Caption
              <textarea
                value={caption}
                maxLength={2200}
                className="border-border bg-card min-h-20 rounded-lg border px-3 py-2"
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
          )}
          <TikTokDirectFields
            context={context}
            settings={settings}
            onChange={setEdited}
          />
          {preview &&
            preview.duration > context.creator.max_video_post_duration_sec && (
              <p role="alert">
                This video is too long. This account supports up to{" "}
                {context.creator.max_video_post_duration_sec} seconds.
              </p>
            )}
          <p className="text-muted-foreground text-xs">
            Processing may take a few minutes before the post appears on your
            profile.
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <p>
            {error
              ? publishErrorCopy(error)
              : "Loading TikTok posting options…"}
          </p>
          {error && (
            <button
              type="button"
              className="underline underline-offset-4"
              onClick={() => beginConnect("tiktok")}
            >
              Reconnect TikTok for Direct Post
            </button>
          )}
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <fieldset disabled={disabled} className="space-y-3 text-sm">
        {body}
        {!preview && (
          <p role="status" className="text-muted-foreground text-xs">
            {previewFailed
              ? "Couldn’t check this video’s length for TikTok. Reopen the video to try again."
              : "Checking video…"}
          </p>
        )}
      </fieldset>
    );
  }
  return (
    <fieldset
      disabled={disabled}
      className="border-border space-y-3 rounded-xl border p-4 text-sm"
    >
      <legend className="px-1 font-semibold">TikTok</legend>
      {preview ? (
        <video
          crossOrigin="anonymous"
          controls
          playsInline
          preload="none"
          aria-label="Video to post to TikTok"
          src={preview.url}
          className="bg-muted max-h-64 w-full rounded-lg"
        />
      ) : (
        <p>
          {previewFailed
            ? "Couldn’t load this video. Close and reopen the publishing sheet to try again."
            : "Loading video preview…"}
        </p>
      )}
      <details>
        <summary className="cursor-pointer">
          TikTok settings ·{" "}
          {tiktokAudience({ mode, caption, settings, ready, loading })}
        </summary>
        <div className="mt-3">{body}</div>
      </details>
    </fieldset>
  );
}
