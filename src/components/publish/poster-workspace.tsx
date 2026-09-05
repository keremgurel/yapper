"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { LayoutGrid, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/studio-ui";
import CrossPostSheet from "@/components/publish/cross-post-sheet";
import { useCaptionDrafts } from "@/components/publish/captions/use-caption-drafts";
import { useCaptionGeneration } from "@/components/publish/captions/use-caption-generation";
import CaptionBriefDisclosure from "@/components/publish/poster/caption-brief-disclosure";
import CoverStudio from "@/components/publish/poster/cover/cover-studio";
import {
  defaultCover,
  type CoverDraft,
} from "@/components/publish/poster/cover-draft";
import DestinationColumn from "@/components/publish/poster/destination-column";
import PosterActions from "@/components/publish/poster/poster-actions";
import {
  currentPosterVideo,
  fromPostable,
  mediaOf,
} from "@/components/publish/poster/poster-video";
import { downloadCover } from "@/components/publish/poster/render-cover";
import SourceTabs from "@/components/publish/poster/sources/source-tabs";
import { useOpenVideo } from "@/components/publish/poster/sources/use-open-video";
import {
  useSourceVideos,
  type PosterSource,
} from "@/components/publish/poster/sources/use-source-videos";
import UploadProgress from "@/components/publish/poster/upload-progress";
import { usePublishPrep } from "@/components/publish/poster/use-publish-prep";
import { useVideoFiles } from "@/components/publish/poster/use-video-files";
import VideoDropzone from "@/components/publish/poster/video-dropzone";
import VideoGrid from "@/components/publish/poster/video-grid";
import VideoRail from "@/components/publish/poster/video-rail";
import { useConnections } from "@/hooks/use-connections";
import { useContentList } from "@/hooks/use-content-list";
import type { PublishPlatform } from "@/lib/db/schema";
import { beginConnect } from "@/lib/publish/begin-connect";
import { DEFAULT_CAPTION_BRIEF } from "@/lib/publish/caption-prompt";
import { postableVideos } from "@/lib/publish/postable-videos";
import type { ContentDetail } from "@/lib/content/client";

/**
 * The Poster: pick a video, prepare it, send it everywhere.
 *
 * One source strip on top: what you made in Yapper, or what you already posted
 * on a connected channel, so reposting an Instagram Reel to YouTube starts by
 * clicking Instagram. Below it, either the grid of that source's videos or, once
 * one is open, the bench: the videos as a rail, the thumbnail in the middle,
 * the destinations on the right with the one publish button. Connecting a
 * channel happens in place, wherever a channel is missing.
 */
export default function PosterWorkspace() {
  const { isSignedIn } = useUser();
  const { items, loadFailed, refresh, prependRow, patchRow } = useContentList(
    !!isSignedIn,
    { includePosterUploads: true },
  );
  const library = useMemo(() => postableVideos(items), [items]);
  const { connections } = useConnections(!!isSignedIn);
  const connectedPlatforms = useMemo(
    () => connections?.map((connection) => connection.platform) ?? [],
    [connections],
  );

  const [source, setSource] = useState<PosterSource>("yapper");
  const sourceVideos = useSourceVideos(
    source,
    { videos: library, loading: items === null },
    !!isSignedIn,
  );
  const bench = useOpenVideo();
  const active = useMemo(
    () => currentPosterVideo(bench.active, library),
    [bench.active, library],
  );

  const [covers, setCovers] = useState<Record<string, CoverDraft>>({});
  const [framePending, setFramePending] = useState(false);
  // Per video, because two videos genuinely go to different places and one
  // shared Set could never say so.
  const [destinationsByVideo, setDestinationsByVideo] = useState<
    Record<string, Set<PublishPlatform>>
  >({});
  const [briefsByVideo, setBriefsByVideo] = useState<Record<string, string>>(
    {},
  );

  const { byVideo, setCaption, applyGenerated } = useCaptionDrafts();
  const { generating, error, generate } = useCaptionGeneration(applyGenerated);
  const prep = usePublishPrep();

  const openUploaded = useCallback(
    (item: ContentDetail) => {
      // Publish the returned row into the shared resource immediately. A
      // refetch races the active selection and used to make a successful
      // upload look as though it vanished.
      prependRow(item);
      const [video] = postableVideos([item]);
      if (video) {
        setSource("yapper");
        bench.setActive(fromPostable(video));
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
  );

  // The editor hands a finished cut over by linking to /studio/poster?item=<id>.
  const params = useSearchParams();
  const requested = params.get("item");
  useEffect(() => {
    if (!requested) return;
    const video = library.find((candidate) => candidate.id === requested);
    if (video) bench.setActive(fromPostable(video));
  }, [requested, library, bench]);

  const cover = active
    ? (covers[active.id] ?? defaultCover(active.title))
    : null;
  // Default destinations: every connected channel except the one the video is
  // already on. That is the whole point of reposting.
  const destinations = useMemo(() => {
    if (!active) return new Set<PublishPlatform>();
    const chosen = destinationsByVideo[active.id];
    if (chosen) return chosen;
    return new Set(
      connectedPlatforms.filter(
        (platform) =>
          !(active.kind === "platform" && active.platform === platform),
      ),
    );
  }, [active, connectedPlatforms, destinationsByVideo]);
  const brief = active
    ? (briefsByVideo[active.id] ?? DEFAULT_CAPTION_BRIEF)
    : DEFAULT_CAPTION_BRIEF;

  const toggleDestination = useCallback(
    (platform: PublishPlatform) => {
      if (!active) return;
      setDestinationsByVideo((current) => {
        const next = new Set(current[active.id] ?? destinations);
        if (next.has(platform)) next.delete(platform);
        else next.add(platform);
        return { ...current, [active.id]: next };
      });
    },
    [active, destinations],
  );

  const draftCaptions = () => {
    if (!active) return;
    void generate(
      [
        {
          id: active.id,
          title: active.title,
          // Present for a library take; it lets the server read the script
          // instead of writing from the title alone.
          contentItemId:
            active.kind === "yapper" ? active.contentItemId : undefined,
        },
      ],
      [...destinations],
      true,
      brief,
    );
  };

  const changeSource = (next: PosterSource) => {
    setSource(next);
    bench.close();
  };

  return (
    <VideoDropzone onFiles={addFiles}>
      <div className="w-full space-y-6">
        <PageHeader
          title="Poster"
          description="Pick a video, choose its thumbnail and captions, and send it to every channel at once."
          actions={
            <PosterActions
              uploadState={uploadState}
              progress={uploadProgress}
              onAdd={openFilePicker}
            />
          }
        />

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
        {bench.error ? (
          <p role="alert" className="text-sm text-[color:var(--sg-yellow-500)]">
            {bench.error}
          </p>
        ) : null}
        {prep.warning ? (
          <p className="text-sm text-[color:var(--sg-yellow-500)]">
            {prep.warning}
          </p>
        ) : null}

        <SourceTabs
          source={source}
          connected={connectedPlatforms}
          onChange={changeSource}
        />

        {source === "yapper" && items === null && loadFailed ? (
          <EmptyState
            icon={RefreshCw}
            title="Your videos could not be loaded"
            description="The library did not answer. Try again, or add a new export and it will open here."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => void refresh()}
              >
                <RefreshCw aria-hidden />
                Try again
              </Button>
            }
          />
        ) : !active || !cover ? (
          <VideoGrid
            source={source}
            videos={sourceVideos.videos}
            loading={sourceVideos.loading}
            connected={sourceVideos.connected}
            activeId={null}
            importingId={bench.importingId}
            uploadState={uploadState}
            uploadProgress={uploadProgress}
            onAdd={openFilePicker}
            onOpen={(video) => void bench.open(video)}
          />
        ) : (
          <div className="grid gap-8 xl:grid-cols-[240px_minmax(0,1fr)_400px]">
            <Section
              title="Videos"
              meta={String(sourceVideos.videos.length)}
              action={
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={bench.close}
                >
                  <LayoutGrid aria-hidden />
                  All videos
                </Button>
              }
            >
              <VideoRail
                source={source}
                videos={sourceVideos.videos}
                activeId={active.id}
                importingId={bench.importingId}
                onOpen={(video) => void bench.open(video)}
                onAdd={openFilePicker}
              />
            </Section>

            <Section title="Thumbnail" meta={active.title}>
              <CoverStudio
                key={active.id}
                draft={cover}
                media={mediaOf(active)}
                onChange={(next) =>
                  setCovers((current) => ({ ...current, [active.id]: next }))
                }
                onDownload={() => void downloadCover(cover)}
                onFramePendingChange={setFramePending}
              />
            </Section>

            <Section title="Send to">
              <div className="space-y-4">
                <DestinationColumn
                  captions={byVideo[active.id]}
                  chosen={destinations}
                  connected={connectedPlatforms}
                  hasCover={Boolean(cover.image)}
                  generating={generating}
                  captionError={error}
                  publishing={prep.preparing}
                  framePending={framePending}
                  transcriptStatus={
                    active.kind === "yapper" ? active.transcriptStatus : null
                  }
                  onToggle={toggleDestination}
                  onConnect={beginConnect}
                  onCaptionChange={(caption) => setCaption(active.id, caption)}
                  onGenerate={draftCaptions}
                  onPublish={() => void prep.prepare([active], covers, byVideo)}
                />
                <CaptionBriefDisclosure
                  value={brief}
                  disabled={generating}
                  onChange={(value) =>
                    setBriefsByVideo((current) => ({
                      ...current,
                      [active.id]: value,
                    }))
                  }
                />
              </div>
            </Section>
          </div>
        )}

        {prep.targets && (
          <CrossPostSheet
            key={prep.targets.map((target) => target.id).join(",")}
            items={prep.targets}
            initialPlatforms={[...destinations]}
            onClose={prep.clear}
          />
        )}
      </div>
    </VideoDropzone>
  );
}
