"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/studio-ui";
import CrossPostSheet from "@/components/publish/cross-post-sheet";
import ScheduleIntentNote from "@/components/publish/schedule/schedule-intent-note";
import {
  blankCaption,
  captionFor,
} from "@/components/publish/captions/caption-draft";
import { renderCaption } from "@/lib/publish/caption-format";
import { useCaptionGeneration } from "@/components/publish/captions/use-caption-generation";
import AttachOriginal from "@/components/publish/poster/attach-original";
import { type CoverDraft } from "@/components/publish/poster/cover-draft";
import {
  sourceCover,
  originalThumbnail,
} from "@/components/publish/poster/source-defaults";
import {
  evaluateDestination,
  publishSummary,
} from "@/lib/publish/destination-readiness";
import {
  applyPosterGeneration,
  posterCaptions,
  type PosterCopy,
} from "@/components/publish/poster/poster-copy";
import {
  PosterProgress,
  PosterRow,
  posterField,
} from "@/components/publish/poster/poster-layout";
import PosterMediaRow from "@/components/publish/poster/poster-media-row";
import DestinationToggles from "@/components/publish/poster/destination-toggles";
import {
  currentPosterVideo,
  fromPostable,
  mediaOf,
  needsOriginal,
  type PosterVideo,
} from "@/components/publish/poster/poster-video";
import SourceOptions from "@/components/publish/poster/sources/source-options";
import ConnectTile from "@/components/publish/poster/sources/connect-tile";
import { isPlatformEnabled } from "@/lib/publish/availability";
import { PLATFORMS } from "@/lib/publish/platforms";
import { useOpenVideo } from "@/components/publish/poster/sources/use-open-video";
import { useRequestedVideo } from "@/components/publish/poster/sources/use-requested-video";
import {
  useSourceVideos,
  type PosterSource,
} from "@/components/publish/poster/sources/use-source-videos";
import UploadProgress from "@/components/publish/poster/upload-progress";
import { usePublishPrep } from "@/components/publish/poster/use-publish-prep";
import { useVideoFiles } from "@/components/publish/poster/use-video-files";
import VideoDropzone from "@/components/publish/poster/video-dropzone";
import VideoRail from "@/components/publish/poster/video-rail";
import { useConnections } from "@/hooks/use-connections";
import { useContentList } from "@/hooks/use-content-list";
import type { PublishPlatform } from "@/lib/db/schema";
import { beginConnect } from "@/lib/publish/begin-connect";
import { DEFAULT_CAPTION_BRIEF } from "@/lib/publish/caption-prompt";
import type { CaptionSet } from "@/components/publish/captions/caption-draft";
import type { PlatformCaption } from "@/lib/publish/caption-format";
import {
  postableVideos,
  posterLibraryVideos,
} from "@/lib/publish/postable-videos";
import type { ContentDetail } from "@/lib/content/client";

const CoverEditor = dynamic(
  () => import("@/components/publish/poster/cover/cover-editor"),
);
const NO_DESTINATIONS = new Set<PublishPlatform>();
const NO_COPY: PosterCopy = {};

export default function PosterWorkspace() {
  const { isSignedIn } = useUser();
  const params = useSearchParams();
  const { items, loadFailed, refresh, prependRow, patchRow, removeRow } =
    useContentList(!!isSignedIn, { includePosterUploads: true });
  const library = useMemo(() => postableVideos(items), [items]);
  const {
    connections,
    error: connectionsError,
    refresh: refreshConnections,
  } = useConnections(!!isSignedIn);
  const connectedPlatforms = useMemo(
    () =>
      connections
        ?.filter((connection) => connection.status === "active")
        .map((connection) => connection.platform) ?? [],
    [connections],
  );

  const [source, setSource] = useState<PosterSource>(() => {
    const requestedSource = params.get("source");
    return requestedSource && isPlatformEnabled(requestedSource)
      ? requestedSource
      : "uploads";
  });
  const sourceVideos = useSourceVideos(
    source,
    {
      videos:
        source === "uploads" ? posterLibraryVideos(items, source) : library,
      loading: items === null,
    },
    !!isSignedIn,
  );
  const bench = useOpenVideo();
  const attachedVideos = useRef(new Map<string, PosterVideo>());
  const openVideo = (video: PosterVideo) => {
    const attached = attachedVideos.current.get(video.id);
    if (attached) {
      bench.close();
      bench.setActive(attached);
    } else void bench.open(video);
  };
  const active = useMemo(
    () => currentPosterVideo(bench.active, library),
    [bench.active, library],
  );

  const [covers, setCovers] = useState<Record<string, CoverDraft>>({});
  const [editingCover, setEditingCover] = useState<string>();
  // Per video, because two videos genuinely go to different places and one
  // shared Set could never say so.
  const [destinationsByVideo, setDestinationsByVideo] = useState<
    Record<string, Set<PublishPlatform>>
  >({});
  const [copyByVideo, setCopyByVideo] = useState<Record<string, PosterCopy>>(
    {},
  );
  const [originalByVideo, setOriginalByVideo] = useState<
    Record<string, string>
  >({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const receiveCopy = useCallback(
    (
      id: string,
      results: PlatformCaption[],
      _titleOnly?: boolean,
      original = "",
      initial?: CaptionSet,
    ) => {
      const result = results[0];
      if (!result || !initial) return;
      const snapshot = captionFor(initial, result.platform);
      setCopyByVideo((all) => ({
        ...all,
        [id]: applyPosterGeneration(
          all[id] ?? NO_COPY,
          original,
          { caption: snapshot.body, title: snapshot.title },
          {
            caption: renderCaption(result),
            title: result.platform === "youtube" ? result.title : undefined,
          },
        ),
      }));
    },
    [],
  );
  const { generating, reading, error, errorVideoId, noSpeech, generate } =
    useCaptionGeneration(
      receiveCopy,
      useCallback((item: ContentDetail) => patchRow(item.id, item), [patchRow]),
    );
  const prep = usePublishPrep();
  const [publishLocked, setPublishLocked] = useState(false);

  const localUpload = useRef<{ id: string; url: string } | null>(null);
  useEffect(
    () => () => {
      if (localUpload.current) URL.revokeObjectURL(localUpload.current.url);
    },
    [],
  );
  const selectLocalFile = useCallback(
    (file: File) => {
      if (localUpload.current) URL.revokeObjectURL(localUpload.current.url);
      const local = { id: crypto.randomUUID(), url: URL.createObjectURL(file) };
      localUpload.current = local;
      bench.close();
      bench.setActive({
        kind: "yapper",
        id: local.id,
        title: file.name.replace(/\.[^.]+$/, ""),
        submissionId: "",
        contentItemId: "",
        previewUrl: local.url,
        status: "ready",
        scheduledFor: null,
        transcriptStatus: "pending",
      });
      setSource("uploads");
    },
    [bench],
  );

  const openUploaded = useCallback(
    (item: ContentDetail) => {
      // Publish the returned row into the shared resource immediately. A
      // refetch races the active selection and used to make a successful
      // upload look as though it vanished.
      prependRow(item);
      const [video] = postableVideos([item]);
      if (video) {
        const local = localUpload.current;
        bench.setActive((current) =>
          current && local && current.id === local.id
            ? { ...fromPostable(video), id: current.id, previewUrl: local?.url }
            : current,
        );
      }
    },
    [prependRow, bench],
  );
  const {
    ref: fileInputRef,
    state: uploadState,
    error: uploadError,
    notice: uploadNotice,
    progress: uploadProgress,
    onChange: onFilesPicked,
    addFiles,
    open: openFilePicker,
  } = useVideoFiles(
    openUploaded,
    useCallback((item: ContentDetail) => patchRow(item.id, item), [patchRow]),
    selectLocalFile,
  );

  const attachOriginal = useCallback(
    (
      original: Extract<NonNullable<typeof active>, { kind: "platform" }>,
      item: ContentDetail,
    ) => {
      prependRow(item);
      const [uploaded] = postableVideos([item]);
      if (!uploaded) return;
      const attached: PosterVideo = {
        ...fromPostable(uploaded),
        id: original.id,
      };
      attachedVideos.current.set(original.id, attached);
      // Preserve this post's drafts and identity. A late upload must never
      // reopen a closed post or replace a different selection.
      bench.setActive((current) =>
        current?.id === original.id ? attached : current,
      );
      setOriginalByVideo((all) => ({
        ...all,
        [original.id]: original.caption ?? "",
      }));
    },
    [prependRow, bench],
  );

  // The editor hands a finished cut over by linking to /studio/poster?item=<id>.
  const requested = params.get("item");
  useRequestedVideo(requested, library, bench.setActive);

  const cover = active ? (covers[active.id] ?? sourceCover(active)) : null;
  const destinations = active
    ? (destinationsByVideo[active.id] ?? NO_DESTINATIONS)
    : NO_DESTINATIONS;
  const copy = active ? (copyByVideo[active.id] ?? NO_COPY) : NO_COPY;
  const original = active
    ? (originalByVideo[active.id] ??
      (active.kind === "platform" ? (active.caption ?? "") : ""))
    : "";
  const shared = copy.caption ?? original;
  const captions = posterCaptions(copy, original);
  const readiness = [...destinations].map((platform) =>
    evaluateDestination({
      platform,
      connected: connectedPlatforms.includes(platform),
      caption: captionFor(captions, platform),
      hasCover: Boolean(cover?.image),
    }),
  );
  const updateCopy = (update: (draft: PosterCopy) => PosterCopy) => {
    if (!active) return;
    setCopyByVideo((all) => ({
      ...all,
      [active.id]: update(all[active.id] ?? NO_COPY),
    }));
  };
  const toggleDestination = (platform: PublishPlatform) => {
    if (!active) return;
    setDestinationsByVideo((current) => {
      const next = new Set(current[active.id]);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return { ...current, [active.id]: next };
    });
  };
  const mediaReady = Boolean(
    active &&
    (active.kind === "platform" ? active.mediaKey : active.submissionId),
  );
  const draftCaptions = () => {
    const platform = destinations.has("youtube")
      ? "youtube"
      : [...destinations][0];
    if (!active || !platform) return;
    void generate(
      [
        {
          id: active.id,
          title: active.title,
          videoDescription: descriptions[active.id],
          captionReference: shared,
          noSpeech: active.kind === "yapper" && active.noSpeech,
          initialCaptions: {
            [platform]: {
              ...blankCaption(platform),
              body: shared,
              title: copy.title ?? "",
            },
          },
          submissionId:
            active.kind === "yapper" ? active.submissionId : undefined,
          transcriptStatus:
            active.kind === "yapper" ? active.transcriptStatus : undefined,
          mediaKey: active.kind === "platform" ? active.mediaKey : undefined,
          sourceCaption: original,
          contentItemId:
            active.kind === "yapper" ? active.contentItemId : undefined,
        },
      ],
      [platform],
      true,
      DEFAULT_CAPTION_BRIEF,
    );
  };
  const closeVideo = () => {
    prep.clear();
    bench.close();
  };

  return (
    <VideoDropzone onFiles={publishLocked ? () => undefined : addFiles}>
      <div className="w-full max-w-4xl">
        <PageHeader
          title="Poster"
          actions={<PosterProgress composing={Boolean(active)} />}
        />
        <ScheduleIntentNote />
        {params.has("connect_error") && (
          <p role="status" className="text-muted-foreground mb-4 text-sm">
            The account wasn’t connected. Choose the source to try again.
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={onFilesPicked}
        />

        <UploadProgress
          state={uploadState}
          progress={uploadProgress}
          error={uploadError}
          notice={uploadNotice}
        />
        {connectionsError && (
          <div
            role="alert"
            className="text-destructive mb-4 flex flex-wrap items-center gap-2 text-sm"
          >
            Your connected accounts couldn’t be refreshed.
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshConnections()}
            >
              Try again
            </Button>
          </div>
        )}

        {!active || !cover ? (
          <section
            aria-labelledby="poster-source-heading"
            className="space-y-4"
          >
            <h2 id="poster-source-heading" className="text-lg font-semibold">
              Choose a source
            </h2>
            <SourceOptions
              selected={source}
              connected={connectedPlatforms}
              uploadBusy={
                uploadState === "uploading" || uploadState === "preparing"
              }
              onUpload={() => {
                setSource("uploads");
                openFilePicker();
              }}
              onChoose={setSource}
            />
            {source !== "uploads" &&
            connections !== null &&
            !connectedPlatforms.includes(source) ? (
              <ConnectTile platform={source} />
            ) : sourceVideos.error ||
              (source === "uploads" && items === null && loadFailed) ? (
              <EmptyState
                icon={RefreshCw}
                title="Videos couldn’t be loaded"
                description="Try loading this source again."
                action={
                  <Button
                    variant="outline"
                    onClick={() =>
                      void (source === "uploads"
                        ? refresh()
                        : sourceVideos.refresh())
                    }
                  >
                    Try again
                  </Button>
                }
              />
            ) : sourceVideos.loading ? (
              <p
                role="status"
                className="border-border text-muted-foreground border-t py-4 text-sm"
              >
                Loading videos…
              </p>
            ) : sourceVideos.videos.length ? (
              <div className="border-border border-t pt-3">
                <h3 className="mb-2 text-sm font-semibold">
                  {source === "uploads"
                    ? "Ready to post"
                    : `Recent ${PLATFORMS[source].label} posts`}
                </h3>
                <VideoRail
                  videos={sourceVideos.videos}
                  onOpen={openVideo}
                  onRemoved={source === "uploads" ? removeRow : undefined}
                />
              </div>
            ) : (
              <p className="border-border text-muted-foreground border-t py-4 text-sm">
                {source === "uploads"
                  ? "Upload a video or pick a platform to reuse one of your posts."
                  : "Your recent videos will appear here."}
              </p>
            )}
          </section>
        ) : (
          <section aria-labelledby="poster-post-heading">
            <h2
              id="poster-post-heading"
              className="border-border border-b pb-4 text-lg font-semibold"
            >
              Create your post
            </h2>
            <PosterMediaRow
              video={active}
              cover={cover}
              locked={publishLocked}
              coverAvailable={
                !needsOriginal(active) &&
                Boolean(mediaReady || active.previewUrl || cover.image)
              }
              onBack={closeVideo}
              onCover={() => setEditingCover(active.id)}
            />
            {active.kind === "platform" && needsOriginal(active) ? (
              <PosterRow label="Original file">
                <AttachOriginal
                  key={active.id}
                  video={active}
                  onAttached={attachOriginal}
                  onUpdated={(item) => patchRow(item.id, item)}
                />
              </PosterRow>
            ) : bench.importingId || bench.error ? (
              <PosterRow label="Original file">
                {bench.error ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <p role="alert">{bench.error}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void bench.open(active)}
                    >
                      Try again
                    </Button>
                  </div>
                ) : (
                  <p role="status" className="text-muted-foreground text-sm">
                    Importing your video…
                  </p>
                )}
              </PosterRow>
            ) : null}
            <CrossPostSheet
              key={`post:${active.id}`}
              embedded
              onBusy={setPublishLocked}
              disabled={
                prep.preparing ||
                !mediaReady ||
                !publishSummary(readiness).canPublish
              }
              poster={{
                coverNote: cover.image
                  ? cover.frameImage
                    ? cover.showHeadline || cover.source !== "frame"
                      ? "TikTok uses the selected video frame without custom cover art or text."
                      : "TikTok uses the selected video frame."
                    : "TikTok uses the video’s default frame."
                  : undefined,
                blockers: readiness.flatMap((item) =>
                  item.state === "empty"
                    ? [
                        item.platform === "youtube"
                          ? "Add a YouTube title to publish."
                          : `Add a caption for ${item.label}.`,
                      ]
                    : item.blockers.map(
                        (message) => `${item.label}: ${message}`,
                      ),
                ),
                destinations: (
                  <DestinationToggles
                    chosen={destinations}
                    connected={connectedPlatforms}
                    onToggle={toggleDestination}
                    onConnect={(platform) =>
                      beginConnect(platform, "poster-draft")
                    }
                  />
                ),
                overrideFor: (platform) => copy.overrides?.[platform],
                setOverride: (platform, value) =>
                  updateCopy((draft) => ({
                    ...draft,
                    overrides: { ...draft.overrides, [platform]: value },
                  })),
                fields: (
                  <>
                    <PosterRow label="Caption" htmlFor="poster-caption">
                      <textarea
                        id="poster-caption"
                        rows={4}
                        className={posterField}
                        value={shared}
                        placeholder="Write a caption…"
                        onChange={(event) =>
                          updateCopy((draft) => ({
                            ...draft,
                            caption: event.target.value,
                            before: undefined,
                          }))
                        }
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {copy.before ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateCopy((draft) =>
                                  draft.before
                                    ? {
                                        ...draft,
                                        ...draft.before,
                                        before: undefined,
                                      }
                                    : draft,
                                )
                              }
                            >
                              Undo generation
                            </Button>
                          ) : original && copy.caption === undefined ? (
                            <span className="text-muted-foreground text-xs">
                              From your original post
                            </span>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={draftCaptions}
                          disabled={
                            generating ||
                            reading ||
                            !destinations.size ||
                            (!mediaReady &&
                              !shared.trim() &&
                              !descriptions[active.id]?.trim())
                          }
                        >
                          {reading
                            ? "Reading video…"
                            : generating
                              ? "Writing…"
                              : destinations.has("youtube")
                                ? "Generate title and captions"
                                : "Generate captions"}
                        </Button>
                      </div>
                      {errorVideoId === active.id && error ? (
                        <p
                          role="alert"
                          className="text-destructive mt-2 text-sm"
                        >
                          {error}
                        </p>
                      ) : null}
                      {(noSpeech[active.id] ||
                        (active.kind === "yapper" && active.noSpeech)) && (
                        <label className="mt-3 block space-y-1 text-sm">
                          <span>
                            No speech detected. Describe the video to generate
                            copy.
                          </span>
                          <textarea
                            className={posterField}
                            rows={2}
                            maxLength={2000}
                            value={descriptions[active.id] ?? ""}
                            onChange={(event) =>
                              setDescriptions((all) => ({
                                ...all,
                                [active.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      )}
                    </PosterRow>
                    {destinations.has("youtube") && (
                      <PosterRow
                        label="YouTube title"
                        htmlFor="poster-youtube-title"
                      >
                        <input
                          id="poster-youtube-title"
                          className={posterField}
                          maxLength={100}
                          aria-required="true"
                          placeholder="Add a title"
                          value={copy.title ?? ""}
                          onChange={(event) =>
                            updateCopy((draft) => ({
                              ...draft,
                              title: event.target.value,
                              before: undefined,
                            }))
                          }
                        />
                      </PosterRow>
                    )}
                  </>
                ),
              }}
              beforePublish={() =>
                prep.prepare(
                  [active],
                  { ...covers, [active.id]: cover },
                  { [active.id]: captions },
                  [...destinations],
                )
              }
              item={{
                id: active.id,
                title: active.title,
                captions,
                submissionId:
                  active.kind === "yapper" ? active.submissionId : undefined,
                mediaKey:
                  active.kind === "platform" ? active.mediaKey : undefined,
                contentItemId:
                  active.kind === "yapper" ? active.contentItemId : undefined,
              }}
              initialPlatforms={[...destinations]}
              onCompleted={(target) => {
                const item = items?.find(
                  (row) => row.id === target.contentItemId,
                );
                if (item?.sourceUrl !== "yapper://poster-upload") return;
                void fetch(`/api/content/${item.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sourceUrl: "yapper://poster-upload/completed",
                  }),
                })
                  .then((response) => {
                    if (response.ok) removeRow(item.id);
                  })
                  .catch(() => {});
              }}
              onClose={prep.clear}
              onNext={() => {
                closeVideo();
                void refresh();
              }}
            />
            {prep.warning ? (
              <p role="status" className="text-muted-foreground mt-3 text-sm">
                {prep.warning}
              </p>
            ) : null}
            {editingCover === active.id && (
              <CoverEditor
                key={`cover:${active.id}`}
                initial={cover}
                media={mediaOf(active)}
                originalImage={originalThumbnail(active)}
                onCancel={() => setEditingCover(undefined)}
                onApply={(next) => {
                  setCovers((all) => ({ ...all, [active.id]: next }));
                  setEditingCover(undefined);
                }}
              />
            )}
          </section>
        )}
      </div>
    </VideoDropzone>
  );
}
