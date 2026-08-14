"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useConnections } from "@/hooks/use-connections";
import type { PublishPlatform } from "@/lib/db/schema";
import {
  crossPostToInstagram,
  crossPostToTikTok,
  crossPostToYouTube,
} from "@/lib/publish/client";
import { connectedInOrder } from "@/lib/publish/connected-order";
import { crossPostTargets } from "@/lib/publish/cross-post-plan";
import { runCrossPost } from "@/lib/publish/run-cross-post";
import { PublishAttemptRegistry } from "@/lib/publish/attempt";
import PreparedCaptions from "@/components/publish/captions/prepared-captions";
import {
  hasPreparedCaptions,
  outgoingCopy,
  type CopyOverride,
} from "@/components/publish/outgoing-copy";
import DestinationGrid from "@/components/publish/sheet/destination-grid";
import NoConnections from "@/components/publish/sheet/no-connections";
import OutcomeList, {
  type SourceOutcome,
} from "@/components/publish/sheet/outcome-list";
import PublishButton from "@/components/publish/sheet/publish-button";
import SingleCopyFields from "@/components/publish/sheet/single-copy-fields";
import SourceList from "@/components/publish/sheet/source-list";
import type { CrossPostTarget } from "./compose/types";

export type { CrossPostTarget } from "./compose/types";

function postSource(
  source: CrossPostTarget,
  platform: PublishPlatform,
  override: CopyOverride | null,
  idempotencyKey: string,
) {
  const { title, body } = outgoingCopy(source, platform, override);
  if (platform === "youtube") {
    return crossPostToYouTube(
      {
        submissionId: source.submissionId,
        mediaKey: source.mediaKey,
        title,
        description: body || undefined,
        contentItemId: source.contentItemId,
        thumbnailKey: source.thumbnailKey,
        privacyStatus: "public",
      },
      idempotencyKey,
    );
  }
  if (platform === "instagram") {
    return crossPostToInstagram(
      {
        submissionId: source.submissionId,
        mediaKey: source.mediaKey,
        caption: body || title || undefined,
        contentItemId: source.contentItemId,
        thumbnailKey: source.thumbnailKey,
      },
      idempotencyKey,
    );
  }
  // TikTok's inbox endpoint takes no caption at all: the video lands in the
  // creator's drafts and they paste the caption in the app.
  return crossPostToTikTok(
    {
      submissionId: source.submissionId,
      mediaKey: source.mediaKey,
      contentItemId: source.contentItemId,
    },
    idempotencyKey,
  );
}

/**
 * One explicit publish surface for one or many videos and one or many
 * destinations. A single click fans every chosen source out to every chosen
 * platform while isolating failures, so an Instagram error never blocks a
 * public YouTube upload.
 *
 * When the Poster has already written a caption per platform, this surface
 * shows them rather than offering a fourth box to edit: the constraints that
 * shape a caption live where it is written.
 */
export default function CrossPostSheet({
  item,
  items,
  initialPlatforms,
  onClose,
}: {
  item?: CrossPostTarget;
  items?: CrossPostTarget[];
  /** Destinations chosen upstream, pre-ticked here so the creator does not
   * pick them twice. Still visible and still removable. */
  initialPlatforms?: PublishPlatform[];
  onClose: () => void;
}) {
  const sources = useMemo(
    () => (items?.length ? items : item ? [item] : []),
    [item, items],
  );
  const prepared = hasPreparedCaptions(sources);
  const single = sources.length === 1 ? sources[0] : null;
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Set<PublishPlatform>>(
    () => new Set(initialPlatforms ?? []),
  );
  const [title, setTitle] = useState(
    single?.initialTitle ?? single?.title ?? "",
  );
  const [caption, setCaption] = useState(single?.initialDescription ?? "");
  const [posting, setPosting] = useState(false);
  const [outcomes, setOutcomes] = useState<SourceOutcome[]>([]);
  const attemptKeys = useRef<PublishAttemptRegistry | null>(null);
  attemptKeys.current ??= new PublishAttemptRegistry();
  const { connections } = useConnections(open);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) onClose();
  };

  const connected = connectedInOrder(
    connections?.map((connection) => connection.platform) ?? [],
  );
  // A platform chosen upstream but never connected has no button here, so it
  // must not be posted to either.
  const chosen = connected.filter((platform) => selected.has(platform));
  const targets = crossPostTargets(chosen);
  // Only the surfaces that prepared nothing get an editable copy field, and
  // only for a single video: a batch has no one title.
  const editable = !prepared && single ? { title, caption } : null;

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
          editable,
          attemptKeys.current!.forTarget(`${source.id}:${platform}`),
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
          {prepared ? (
            <PreparedCaptions sources={sources} />
          ) : editable ? (
            <SingleCopyFields
              title={title}
              caption={caption}
              disabled={posting}
              onTitle={setTitle}
              onCaption={setCaption}
            />
          ) : (
            <SourceList sources={sources} />
          )}

          {connections === null ? (
            <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              Loading your connections…
            </div>
          ) : connected.length === 0 ? (
            <NoConnections />
          ) : (
            <>
              <DestinationGrid
                connected={connected}
                selected={selected}
                disabled={posting}
                onToggle={togglePlatform}
                onToggleAll={() =>
                  setSelected(
                    chosen.length === connected.length
                      ? new Set()
                      : new Set(connected),
                  )
                }
              />

              <OutcomeList outcomes={outcomes} />

              {failures.length > 0 && done && (
                <p className="text-xs font-semibold text-[color:var(--sg-pink-500)]">
                  {failures.length} destination
                  {failures.length === 1 ? "" : "s"} failed. Successful posts
                  were not rolled back.
                </p>
              )}

              <PublishButton
                videos={sources.length}
                platforms={chosen.length}
                postedSoFar={outcomes.length}
                posting={posting}
                done={done}
                disabled={
                  posting ||
                  sources.length === 0 ||
                  chosen.length === 0 ||
                  (editable ? !title.trim() : false)
                }
                onPublish={() => void publish()}
              />
              <p className="text-muted-foreground text-center text-xs">
                YouTube posts are requested as public. TikTok lands in your
                drafts and takes no caption over its API, so paste it in the
                app.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
