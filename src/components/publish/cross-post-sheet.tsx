"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
  crossPostToFacebook,
  crossPostToTikTokDirect,
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
import ScheduleButton from "@/components/publish/schedule/schedule-button";
import ScheduledNotice from "@/components/publish/schedule/scheduled-notice";
import { scheduleTargets } from "@/components/publish/schedule/schedule-targets";
import { useScheduleSubmit } from "@/components/publish/schedule/use-schedule-submit";
import { useSchedulingAvailable } from "@/components/publish/schedule/use-scheduling-available";
import { useWhen } from "@/components/publish/schedule/use-when";
import WhenPicker from "@/components/publish/schedule/when-picker";
import SourceList from "@/components/publish/sheet/source-list";
import TikTokPostReview, { type TikTokReview } from "./tiktok-post-review";
import type { CrossPostTarget } from "./compose/types";

import YouTubeSettingsFields, {
  INITIAL_YOUTUBE_SETTINGS,
  type YouTubeSettings,
} from "./youtube-settings";

export type { CrossPostTarget } from "./compose/types";

function postSource(
  source: CrossPostTarget,
  platform: PublishPlatform,
  override: CopyOverride | null,
  idempotencyKey: string,
  tiktokReview?: TikTokReview,
  expectedAccountId?: string,
  youtubeSettings?: YouTubeSettings,
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
        privacyStatus: youtubeSettings?.privacyStatus ?? "public",
        selfDeclaredMadeForKids:
          youtubeSettings?.selfDeclaredMadeForKids ?? undefined,
        containsSyntheticMedia: youtubeSettings?.containsSyntheticMedia,
      },
      idempotencyKey,
    );
  }
  if (platform === "instagram" || platform === "facebook") {
    const input = {
      submissionId: source.submissionId,
      mediaKey: source.mediaKey,
      caption: body || title || undefined,
      contentItemId: source.contentItemId,
      thumbnailKey: source.thumbnailKey,
    };
    return platform === "facebook"
      ? crossPostToFacebook(
          { ...input, expectedAccountId: expectedAccountId ?? "" },
          idempotencyKey,
        )
      : crossPostToInstagram(input, idempotencyKey);
  }
  if (tiktokReview?.mode === "direct")
    return crossPostToTikTokDirect(
      {
        submissionId: source.submissionId,
        mediaKey: source.mediaKey,
        contentItemId: source.contentItemId,
        caption: tiktokReview.caption,
        settings: tiktokReview.settings,
      },
      idempotencyKey,
    );
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
  onNext,
  onCompleted,
  embedded = false,
  disabled = false,
  beforePublish,
  onBusy,
}: {
  onBusy?: (busy: boolean) => void;
  embedded?: boolean;
  disabled?: boolean;
  beforePublish?: () => Promise<CrossPostTarget[] | undefined>;
  item?: CrossPostTarget;
  items?: CrossPostTarget[];
  /** Destinations chosen upstream, pre-ticked here so the creator does not
   * pick them twice. Still visible and still removable. */
  initialPlatforms?: PublishPlatform[];
  onClose: () => void;
  onNext?: () => void;
  onCompleted?: (source: CrossPostTarget) => void;
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
  const [youtubeSettings, setYouTubeSettings] = useState<YouTubeSettings>(
    embedded
      ? {
          ...INITIAL_YOUTUBE_SETTINGS,
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        }
      : INITIAL_YOUTUBE_SETTINGS,
  );
  const [posting, setPosting] = useState(false);
  const [publishError, setPublishError] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const operation = useRef(false);
  const [tiktokReviews, setTikTokReviews] = useState<
    Record<string, TikTokReview>
  >({});
  const onTikTokReview = useCallback(
    (id: string, review: TikTokReview) =>
      setTikTokReviews((current) => ({ ...current, [id]: review })),
    [],
  );
  const when = useWhen();
  const schedulingAvailable = useSchedulingAvailable();
  const scheduler = useScheduleSubmit((busy) => {
    operation.current = busy;
    setScheduling(busy);
    onBusy?.(busy);
  });
  const scheduled = scheduler.savedFor !== null;
  const later = schedulingAvailable === true && when.mode === "later";
  const [outcomes, setOutcomes] = useState<SourceOutcome[]>([]);
  const attemptKeys = useRef<PublishAttemptRegistry | null>(null);
  attemptKeys.current ??= new PublishAttemptRegistry();
  const {
    connections,
    error: connectionsError,
    refresh: refreshConnections,
  } = useConnections(open);

  const close = (next: boolean) => {
    if (operation.current) return;
    setOpen(next);
    if (!next) onClose();
  };

  const connected = connectedInOrder(
    connections
      ?.filter(
        (connection) =>
          connection.status === "active" &&
          (connection.platform !== "facebook" ||
            !!connection.externalAccountId),
      )
      .map((connection) => connection.platform) ?? [],
  );
  // A platform chosen upstream but never connected has no button here, so it
  // must not be posted to either.
  const chosen = connected.filter((platform) =>
    embedded ? initialPlatforms?.includes(platform) : selected.has(platform),
  );
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

  const youtubeDescriptionTooLong =
    chosen.includes("youtube") &&
    sources.some(
      (source) =>
        new TextEncoder().encode(outgoingCopy(source, "youtube", editable).body)
          .byteLength > 5000,
    );
  const youtubeReady =
    !chosen.includes("youtube") ||
    (youtubeSettings.selfDeclaredMadeForKids !== null &&
      !youtubeDescriptionTooLong);
  const tiktokReady =
    !chosen.includes("tiktok") ||
    sources.every((source) => tiktokReviews[source.id]?.ready);

  const publish = async () => {
    if (
      disabled ||
      (embedded && chosen.length !== initialPlatforms?.length) ||
      !youtubeReady ||
      !tiktokReady ||
      operation.current ||
      scheduled ||
      sources.length === 0 ||
      targets.length === 0
    )
      return;
    operation.current = true;
    setPosting(true);
    onBusy?.(true);
    setPublishError("");
    try {
      setOutcomes([]);
      const finished: SourceOutcome[] = [];
      const publishSources = beforePublish ? await beforePublish() : sources;
      if (!publishSources?.length) {
        return;
      }
      // Keep source files sequential so a multi-video batch does not hold several
      // large uploads in memory. Each video's platform fan-out still runs in
      // parallel and independently through runCrossPost.
      for (const source of publishSources) {
        await runCrossPost(
          targets,
          (platform) =>
            postSource(
              source,
              platform,
              editable,
              attemptKeys.current!.forTarget(`${source.id}:${platform}`),
              tiktokReviews[source.id],
              connections?.find(
                (connection) => connection.platform === platform,
              )?.externalAccountId ?? undefined,
              youtubeSettings,
            ),
          (result) => {
            finished.push({
              ...result,
              sourceId: source.id,
              sourceTitle: source.title,
            });
            setOutcomes([...finished]);
          },
        );
      }
      for (const source of publishSources) {
        const results = finished.filter(
          (outcome) => outcome.sourceId === source.id,
        );
        if (
          results.length === targets.length &&
          results.every(
            (outcome) =>
              outcome.status === "posted" || outcome.status === "draft",
          )
        )
          onCompleted?.(source);
      }
    } catch {
      setPublishError("Couldn’t prepare this post. Try publishing again.");
    } finally {
      operation.current = false;
      setPosting(false);
      onBusy?.(false);
    }
  };

  const accounts = Object.fromEntries(
    (connections ?? []).map((connection) => [
      connection.platform,
      connection.externalAccountId ?? "",
    ]),
  );
  const postCount =
    sources.length *
    (embedded ? (initialPlatforms?.length ?? 0) : chosen.length);
  const schedule = () =>
    void scheduler.submit(when.at ?? new Date(NaN), async () => {
      const prepared = beforePublish ? await beforePublish() : sources;
      if (!prepared?.length) return null;
      return scheduleTargets(
        prepared,
        targets.map((target) => target.platform),
        { override: editable, accounts, youtubeSettings, tiktokReviews },
      );
    });
  const tiktokDraftLater =
    chosen.includes("tiktok") &&
    sources.some((source) => tiktokReviews[source.id]?.mode === "inbox");

  const done =
    outcomes.length > 0 && outcomes.length === sources.length * targets.length;
  const failures = outcomes.filter((outcome) => outcome.status === "failed");

  const content = (
    <>
      {!embedded && (
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
      )}

      <div
        className={embedded ? "flex flex-col gap-4" : "flex flex-col gap-5 p-4"}
      >
        {publishError && (
          <p role="alert" className="text-destructive text-sm">
            {publishError}
          </p>
        )}
        {embedded ? null : prepared ? (
          <PreparedCaptions sources={sources} />
        ) : editable ? (
          <SingleCopyFields
            title={title}
            caption={caption}
            disabled={posting || scheduling || scheduled || outcomes.length > 0}
            onTitle={setTitle}
            onCaption={setCaption}
          />
        ) : (
          <SourceList sources={sources} />
        )}

        {connections === null && connectionsError ? (
          <div role="alert" className="space-y-2 text-sm">
            <p>Your connections couldn’t be loaded.</p>
            <button
              type="button"
              className="underline"
              onClick={() => void refreshConnections()}
            >
              Try again
            </button>
          </div>
        ) : connections === null ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Loading your connections…
          </div>
        ) : connected.length === 0 ? (
          <NoConnections />
        ) : (
          <>
            {!embedded && (
              <DestinationGrid
                accounts={Object.fromEntries(
                  (connections ?? []).map((connection) => [
                    connection.platform,
                    connection.handle ??
                      connection.externalAccountId ??
                      "Connected account",
                  ]),
                )}
                connected={connected}
                selected={selected}
                disabled={
                  posting || scheduling || scheduled || outcomes.length > 0
                }
                onToggle={togglePlatform}
                onToggleAll={() =>
                  setSelected(
                    chosen.length === connected.length
                      ? new Set()
                      : new Set(connected),
                  )
                }
              />
            )}

            {youtubeDescriptionTooLong && (
              <p role="alert" className="text-destructive text-xs">
                Shorten the YouTube description to 5,000 bytes or fewer.
              </p>
            )}
            {chosen.includes("youtube") &&
              (embedded ? (
                <details>
                  <summary className="cursor-pointer text-sm">
                    YouTube settings · {youtubeSettings.privacyStatus}
                  </summary>
                  <div className="mt-3">
                    <YouTubeSettingsFields
                      value={youtubeSettings}
                      onChange={setYouTubeSettings}
                      disabled={
                        posting ||
                        scheduling ||
                        scheduled ||
                        outcomes.length > 0
                      }
                    />
                  </div>
                </details>
              ) : (
                <YouTubeSettingsFields
                  value={youtubeSettings}
                  onChange={setYouTubeSettings}
                  disabled={
                    posting || scheduling || scheduled || outcomes.length > 0
                  }
                />
              ))}
            {chosen.includes("tiktok") &&
              sources.map((source) => (
                <TikTokPostReview
                  key={source.id}
                  source={source}
                  compact={embedded}
                  initialCaption={
                    outgoingCopy(source, "tiktok", editable).body ||
                    outgoingCopy(source, "tiktok", editable).title
                  }
                  disabled={posting || outcomes.length > 0}
                  onChange={onTikTokReview}
                />
              ))}
            {chosen.includes("facebook") && (
              <p className="text-muted-foreground text-xs">
                Facebook Reels will be public on your selected Page. Use
                vertical videos, 3–90 seconds, at least 540 × 960 pixels.
              </p>
            )}
            <OutcomeList outcomes={outcomes} />

            {failures.length > 0 && done && (
              <p className="text-xs font-semibold text-[color:var(--sg-pink-500)]">
                {failures.length} destination
                {failures.length === 1 ? "" : "s"} failed. Successful posts were
                not rolled back.
              </p>
            )}

            {schedulingAvailable && outcomes.length === 0 && !scheduled && (
              <WhenPicker
                mode={when.mode}
                onMode={when.setMode}
                value={when.value}
                onValue={when.setValue}
                disabled={posting || scheduling}
                note={
                  tiktokDraftLater
                    ? "TikTok gets a draft at that time, to finish in the app."
                    : undefined
                }
              />
            )}
            {scheduler.savedFor && (
              <ScheduledNotice at={scheduler.savedFor} count={postCount} />
            )}
            {scheduler.error && (
              <p role="alert" className="text-destructive text-sm">
                {scheduler.error}
              </p>
            )}
            {later && !scheduled && postCount > 20 && (
              <p className="text-destructive text-xs">
                Schedule up to 20 posts at a time.
              </p>
            )}
            {later
              ? !scheduled && (
                  <ScheduleButton
                    at={when.at}
                    count={postCount}
                    saving={scheduling}
                    disabled={
                      disabled ||
                      (embedded &&
                        chosen.length !== initialPlatforms?.length) ||
                      posting ||
                      scheduling ||
                      !youtubeReady ||
                      !tiktokReady ||
                      sources.length === 0 ||
                      chosen.length === 0 ||
                      postCount > 20 ||
                      (editable ? !title.trim() : false)
                    }
                    onSchedule={schedule}
                  />
                )
              : !scheduled &&
                (!done ||
                  failures.length > 0 ||
                  outcomes.some((outcome) => outcome.status === "pending")) && (
                  <PublishButton
                    videos={sources.length}
                    platforms={
                      embedded ? (initialPlatforms?.length ?? 0) : chosen.length
                    }
                    postedSoFar={outcomes.length}
                    posting={posting}
                    done={done}
                    disabled={
                      disabled ||
                      (embedded &&
                        chosen.length !== initialPlatforms?.length) ||
                      posting ||
                      !youtubeReady ||
                      !tiktokReady ||
                      scheduling ||
                      sources.length === 0 ||
                      chosen.length === 0 ||
                      (editable ? !title.trim() : false)
                    }
                    onPublish={() => void publish()}
                  />
                )}
            {onNext && !posting && (done || scheduled) && (
              <Button onClick={onNext}>Post another video</Button>
            )}
            <p className="text-muted-foreground text-center text-xs">
              For TikTok, review the audience and posting method above.
            </p>
          </>
        )}
      </div>
    </>
  );
  return embedded ? (
    content
  ) : (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl">
        {content}
      </SheetContent>
    </Sheet>
  );
}
