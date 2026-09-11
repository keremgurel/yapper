"use client";
import { useEffect, useState } from "react";
import { beginConnect } from "@/lib/publish/begin-connect";
import { publishErrorCopy } from "@/lib/publish/error-copy";
import {
  validateTikTokDirectSettings,
  type TikTokCreator,
  type TikTokDirectSettings,
  type TikTokPrivacy,
} from "@/lib/publish/tiktok-direct-settings";
import type { CrossPostTarget } from "./compose/types";
export interface TikTokReview {
  mode: "direct" | "inbox";
  caption: string;
  settings: TikTokDirectSettings;
  ready: boolean;
}
const labels: Record<TikTokPrivacy, string> = {
  PUBLIC_TO_EVERYONE: "Everyone",
  MUTUAL_FOLLOW_FRIENDS: "Friends",
  FOLLOWER_OF_CREATOR: "Followers",
  SELF_ONLY: "Only me",
};
export default function TikTokPostReview({
  source,
  initialCaption,
  disabled,
  onChange,
}: {
  source: CrossPostTarget;
  initialCaption: string;
  disabled: boolean;
  onChange: (id: string, review: TikTokReview) => void;
}) {
  const [mode, setMode] = useState<"direct" | "inbox">("direct");
  const [caption, setCaption] = useState(initialCaption);
  const [context, setContext] = useState<{
    creator: TikTokCreator;
    audited: boolean;
    accountId: string;
  } | null>(null);
  const [preview, setPreview] = useState<{
    url: string;
    duration: number;
  } | null>(null);
  const [error, setError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [settings, setSettings] = useState<TikTokDirectSettings>({
    privacy: "" as TikTokPrivacy,
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    discloseCommercial: false,
    ownBrand: false,
    brandedContent: false,
    aiGenerated: false,
    consent: false,
    accountId: "",
  });
  const { submissionId, mediaKey, id } = source;
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/publish/tiktok/creator", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
      })
      .then((data) => {
        setContext(data);
        setSettings((s) => ({ ...s, accountId: data.accountId }));
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "tiktok_creator_unavailable",
          );
      });
    fetch("/api/publish/preview", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submissionId, mediaKey }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setPreview)
      .catch(() => {
        if (!controller.signal.aborted)
          setPreviewError(
            "Couldn’t load this video. Close and reopen the publishing sheet to try again.",
          );
      });
    return () => controller.abort();
  }, [submissionId, mediaKey]);
  const invalid =
    context && preview
      ? validateTikTokDirectSettings(
          settings,
          context.creator,
          preview.duration,
          context.audited,
        )
      : "not_ready";
  useEffect(() => {
    onChange(id, {
      mode,
      caption,
      settings,
      ready:
        !!preview && (mode === "inbox" || (!invalid && caption.length <= 2200)),
    });
  }, [id, mode, caption, settings, invalid, preview, onChange]);
  const update = <K extends keyof TikTokDirectSettings>(
    key: K,
    value: TikTokDirectSettings[K],
  ) => setSettings((current) => ({ ...current, [key]: value }));
  return (
    <fieldset
      disabled={disabled}
      className="border-border space-y-3 rounded-xl border p-4 text-sm"
    >
      <legend className="px-1 font-semibold">TikTok · {source.title}</legend>
      {preview ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={preview.url}
          className="bg-muted max-h-64 w-full rounded-lg"
        />
      ) : (
        <p>{previewError || "Loading video preview…"}</p>
      )}
      <label className="flex flex-col gap-1">
        Posting method
        <select
          className="border-border bg-background rounded-md border p-2"
          value={mode}
          onChange={(event) =>
            setMode(event.target.value as "direct" | "inbox")
          }
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
      ) : (
        <>
          {context ? (
            <>
              <p>
                Posting as <strong>{context.creator.creator_nickname}</strong>{" "}
                (@{context.creator.creator_username})
              </p>
              {!context.audited && (
                <p className="text-muted-foreground text-xs">
                  TikTok’s review is pending. Test posts must use “Only me” and
                  a private TikTok account. Public posting becomes available
                  after approval.
                </p>
              )}
              <label className="flex flex-col gap-1">
                Caption
                <textarea
                  value={caption}
                  maxLength={2200}
                  className="border-border bg-background min-h-20 rounded-md border p-2"
                  onChange={(event) => setCaption(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                Who can see this video?
                <select
                  value={settings.privacy}
                  className="border-border bg-background rounded-md border p-2"
                  onChange={(event) =>
                    update("privacy", event.target.value as TikTokPrivacy)
                  }
                >
                  <option value="" disabled>
                    Choose an audience
                  </option>
                  {context.creator.privacy_level_options
                    .filter((p) => context.audited || p === "SELF_ONLY")
                    .map((p) => (
                      <option
                        key={p}
                        value={p}
                        disabled={p === "SELF_ONLY" && settings.brandedContent}
                      >
                        {labels[p] ?? p}
                      </option>
                    ))}
                </select>
              </label>
              {(
                [
                  [
                    "allowComment",
                    "Allow comments",
                    context.creator.comment_disabled,
                  ],
                  ["allowDuet", "Allow Duet", context.creator.duet_disabled],
                  [
                    "allowStitch",
                    "Allow Stitch",
                    context.creator.stitch_disabled,
                  ],
                ] as const
              ).map(([key, label, blocked]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 ${blocked ? "text-muted-foreground" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    disabled={blocked}
                    onChange={(event) => update(key, event.target.checked)}
                  />
                  {label}
                  {blocked ? " (disabled in TikTok)" : ""}
                </label>
              ))}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.discloseCommercial}
                  onChange={(event) =>
                    setSettings((s) => ({
                      ...s,
                      discloseCommercial: event.target.checked,
                      ownBrand: false,
                      brandedContent: false,
                    }))
                  }
                />
                Disclose commercial content
              </label>
              {settings.discloseCommercial && (
                <div className="space-y-2 pl-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.ownBrand}
                      onChange={(event) =>
                        update("ownBrand", event.target.checked)
                      }
                    />
                    Your brand
                  </label>
                  <label
                    className={`flex items-center gap-2 ${settings.privacy === "SELF_ONLY" ? "text-muted-foreground" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.brandedContent}
                      disabled={settings.privacy === "SELF_ONLY"}
                      onChange={(event) =>
                        update("brandedContent", event.target.checked)
                      }
                    />
                    Branded content
                  </label>
                  {settings.privacy === "SELF_ONLY" && (
                    <p className="text-xs">
                      Branded content visibility cannot be set to private.
                    </p>
                  )}
                  {!settings.ownBrand && !settings.brandedContent && (
                    <p className="text-xs">
                      Indicate whether this promotes your brand, a third party,
                      or both.
                    </p>
                  )}
                  {(settings.ownBrand || settings.brandedContent) && (
                    <p className="text-xs">
                      Your video will be labeled as “
                      {settings.brandedContent
                        ? "Paid partnership"
                        : "Promotional content"}
                      ”.
                    </p>
                  )}
                </div>
              )}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings.aiGenerated}
                  onChange={(event) =>
                    update("aiGenerated", event.target.checked)
                  }
                />
                Label this video as AI-generated
              </label>
              {preview &&
                preview.duration >
                  context.creator.max_video_post_duration_sec && (
                  <p role="alert">
                    This video is too long. This account supports up to{" "}
                    {context.creator.max_video_post_duration_sec} seconds.
                  </p>
                )}
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={settings.consent}
                  onChange={(event) => update("consent", event.target.checked)}
                />
                <span>
                  I reviewed this video and authorize posting. By posting, you
                  agree to TikTok’s{" "}
                  {settings.brandedContent && (
                    <>
                      <a
                        className="underline"
                        href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Branded Content Policy
                      </a>{" "}
                      and{" "}
                    </>
                  )}
                  <a
                    className="underline"
                    href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Music Usage Confirmation
                  </a>
                  .
                </span>
              </label>
              <p className="text-muted-foreground text-xs">
                Processing may take a few minutes before the post appears on
                your profile.
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
                  className="underline"
                  onClick={() => beginConnect("tiktok")}
                >
                  Reconnect TikTok for Direct Post
                </button>
              )}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}
