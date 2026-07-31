"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, Loader2, Send, Video } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useConnections } from "@/hooks/use-connections";
import type { PublishPlatform } from "@/lib/db/schema";
import {
  crossPostToInstagram,
  crossPostToTikTok,
  crossPostToYouTube,
} from "@/lib/publish/client";
import { connectedInOrder } from "@/lib/publish/connected-order";
import { crossPostTargets } from "@/lib/publish/cross-post-plan";
import { PLATFORMS } from "@/lib/publish/platforms";
import {
  runCrossPost,
  type CrossPostOutcome,
} from "@/lib/publish/run-cross-post";
import type { CrossPostTarget } from "./compose/types";

export type { CrossPostTarget } from "./compose/types";

interface SourceOutcome extends CrossPostOutcome {
  sourceId: string;
  sourceTitle: string;
}

function postSource(
  source: CrossPostTarget,
  platform: PublishPlatform,
  singleTitle: string,
  singleCaption: string,
) {
  const title = singleTitle.trim() || source.initialTitle || source.title;
  const caption = singleCaption.trim() || source.initialDescription;
  if (platform === "youtube") {
    return crossPostToYouTube({
      submissionId: source.submissionId,
      mediaKey: source.mediaKey,
      title,
      description: caption || undefined,
      contentItemId: source.contentItemId,
      thumbnailKey: source.thumbnailKey,
      privacyStatus: "public",
    });
  }
  if (platform === "instagram") {
    return crossPostToInstagram({
      submissionId: source.submissionId,
      mediaKey: source.mediaKey,
      caption: caption || title || undefined,
      contentItemId: source.contentItemId,
      thumbnailKey: source.thumbnailKey,
    });
  }
  return crossPostToTikTok({
    submissionId: source.submissionId,
    mediaKey: source.mediaKey,
    contentItemId: source.contentItemId,
  });
}

/**
 * One explicit publish surface for one or many videos and one or many
 * destinations. Nothing is selected automatically. A single click fans every
 * chosen source out to every chosen platform while isolating failures, so an
 * Instagram error never blocks a public YouTube upload.
 */
export default function CrossPostSheet({
  item,
  items,
  onClose,
}: {
  item?: CrossPostTarget;
  items?: CrossPostTarget[];
  onClose: () => void;
}) {
  const sources = useMemo(
    () => (items?.length ? items : item ? [item] : []),
    [item, items],
  );
  const single = sources.length === 1 ? sources[0] : null;
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<PublishPlatform>>(new Set());
  const [title, setTitle] = useState(
    single?.initialTitle ?? single?.title ?? "",
  );
  const [caption, setCaption] = useState(single?.initialDescription ?? "");
  const [posting, setPosting] = useState(false);
  const [outcomes, setOutcomes] = useState<SourceOutcome[]>([]);
  const { connections } = useConnections(open);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) onClose();
  };

  const connected = connectedInOrder(
    connections?.map((connection) => connection.platform) ?? [],
  );
  const targets = crossPostTargets([...selected]);

  const togglePlatform = (platform: PublishPlatform) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  };

  const publish = async () => {
    if (posting || sources.length === 0 || targets.length === 0) return;
    setPosting(true);
    setOutcomes([]);
    const finished: SourceOutcome[] = [];
    // Keep source files sequential so a multi-video batch does not hold several
    // large uploads in memory. Each video's platform fan-out still runs in
    // parallel and independently through runCrossPost.
    for (const source of sources) {
      const sourceResults = await runCrossPost(targets, (platform) =>
        postSource(
          source,
          platform,
          single ? title : (source.initialTitle ?? source.title),
          single ? caption : (source.initialDescription ?? ""),
        ),
      );
      finished.push(
        ...sourceResults.map((result) => ({
          ...result,
          sourceId: source.id,
          sourceTitle: source.title,
        })),
      );
      setOutcomes([...finished]);
    }
    setPosting(false);
  };

  const done = outcomes.length === sources.length * targets.length;
  const failures = outcomes.filter((outcome) => outcome.status === "failed");

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>
            Cross-post{" "}
            {sources.length > 1 ? `${sources.length} videos` : "video"}
          </SheetTitle>
          <SheetDescription>
            Choose every destination you want. One action publishes the full
            selection; Yapper never silently chooses a platform.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 p-4">
          {sources.length > 1 ? (
            <div className="border-border bg-muted/25 rounded-2xl border p-3">
              <p className="text-foreground/60 mb-2 text-[11px] font-black tracking-wide uppercase">
                Videos
              </p>
              <div className="space-y-1.5">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className="text-foreground flex items-center gap-2 text-sm font-bold"
                  >
                    <Video className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
                    <span className="truncate">{source.title}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : single ? (
            <div className="space-y-3">
              <label className="block">
                <span className="text-foreground/65 mb-1.5 block text-xs font-black">
                  Title
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={100}
                  disabled={posting}
                  className="border-border bg-card text-foreground w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none focus:border-[color:var(--sg-accent)]"
                />
              </label>
              <label className="block">
                <span className="text-foreground/65 mb-1.5 block text-xs font-black">
                  Caption / description
                </span>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={4}
                  maxLength={2200}
                  disabled={posting}
                  placeholder="Used for Instagram and YouTube."
                  className="border-border bg-card text-foreground placeholder:text-muted-foreground w-full resize-none rounded-xl border px-3 py-2.5 text-sm leading-6 outline-none focus:border-[color:var(--sg-accent)]"
                />
              </label>
            </div>
          ) : null}

          {connections === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your connections…
            </div>
          ) : connected.length === 0 ? (
            <div className="text-muted-foreground py-6 text-sm">
              <p className="text-foreground font-bold">
                No platforms connected
              </p>
              <p className="mt-1">
                Connect YouTube, TikTok, or Instagram first.
              </p>
              <Link
                href="/studio/connections"
                className="mt-3 inline-block font-bold text-[color:var(--sg-accent)] hover:opacity-80"
              >
                Go to Connections
              </Link>
            </div>
          ) : (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-foreground/65 text-[11px] font-black tracking-wide uppercase">
                    Destinations
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setSelected(
                        selected.size === connected.length
                          ? new Set()
                          : new Set(connected),
                      )
                    }
                    className="text-xs font-black text-[color:var(--sg-accent)]"
                  >
                    {selected.size === connected.length
                      ? "Clear"
                      : "Select all"}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {connected.map((platform) => {
                    const active = selected.has(platform);
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => togglePlatform(platform)}
                        disabled={posting}
                        className={`relative rounded-xl border px-3 py-3 text-left transition ${
                          active
                            ? "border-[color:var(--sg-accent)] bg-[color:color-mix(in_srgb,var(--sg-accent)_10%,transparent)]"
                            : "border-border hover:border-foreground/25"
                        }`}
                      >
                        <span className="text-foreground block text-xs font-black">
                          {PLATFORMS[platform].label}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-[10px] leading-4">
                          {PLATFORMS[platform].postMeaning}
                        </span>
                        <span
                          className={`absolute top-2 right-2 grid h-5 w-5 place-items-center rounded-full border ${
                            active
                              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-black"
                              : "border-border text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {outcomes.length > 0 && (
                <div className="border-border rounded-2xl border">
                  {outcomes.map((outcome) => (
                    <div
                      key={`${outcome.sourceId}-${outcome.platform}`}
                      className="border-border flex items-center justify-between gap-3 border-b px-3 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-bold">
                          {outcome.sourceTitle}
                        </p>
                        <p className="text-muted-foreground text-[11px]">
                          {PLATFORMS[outcome.platform].label}
                        </p>
                      </div>
                      {outcome.url ? (
                        <a
                          href={outcome.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-black text-[color:var(--sg-accent)]"
                        >
                          Posted <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span
                          className={`text-xs font-black ${
                            outcome.status === "failed"
                              ? "text-red-500"
                              : "text-[color:var(--sg-green-500)]"
                          }`}
                        >
                          {outcome.status === "draft"
                            ? "Sent to drafts"
                            : outcome.status === "failed"
                              ? "Failed"
                              : "Posted"}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {failures.length > 0 && done && (
                <p className="text-xs font-bold text-red-500">
                  {failures.length} destination
                  {failures.length === 1 ? "" : "s"} failed. Successful posts
                  were not rolled back.
                </p>
              )}

              <Button
                type="button"
                onClick={() => void publish()}
                disabled={
                  posting ||
                  sources.length === 0 ||
                  selected.size === 0 ||
                  (single ? !title.trim() : false)
                }
                style={{ background: "var(--sg-accent-gradient)" }}
                className="text-white"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {posting
                  ? `Publishing ${outcomes.length + 1} of ${sources.length * targets.length}…`
                  : done
                    ? "Publish again"
                    : `Publish ${sources.length} video${sources.length === 1 ? "" : "s"} to ${selected.size} platform${selected.size === 1 ? "" : "s"}`}
              </Button>
              <p className="text-muted-foreground text-center text-[11px]">
                YouTube posts are requested as public. TikTok currently lands in
                drafts until its direct-post approval is active.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
