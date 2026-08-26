"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { EmptyState, PageHeader, Section } from "@/components/studio-ui";
import CrossPostSheet from "@/components/publish/cross-post-sheet";
import PlatformVideos from "@/components/publish/platform-videos";
import { useCaptionDrafts } from "@/components/publish/captions/use-caption-drafts";
import { useCaptionGeneration } from "@/components/publish/captions/use-caption-generation";
import PosterActions from "@/components/publish/poster/poster-actions";
import DestinationColumn from "@/components/publish/poster/destination-column";
import GenerationBrief from "@/components/publish/poster/generation-brief";
import VideoDropzone from "@/components/publish/poster/video-dropzone";
import VideoGrid from "@/components/publish/poster/video-grid";
import CoverCanvas from "@/components/publish/poster/cover-canvas";
import {
  defaultCover,
  type CoverDraft,
} from "@/components/publish/poster/cover-draft";
import { downloadCover } from "@/components/publish/poster/render-cover";
import { uploadErrorText } from "@/components/publish/poster/upload-error";
import { usePublishPrep } from "@/components/publish/poster/use-publish-prep";
import { useVideoFiles } from "@/components/publish/poster/use-video-files";
import { useVideoSelection } from "@/components/publish/poster/use-video-selection";
import { useConnections } from "@/hooks/use-connections";
import { useContentList } from "@/hooks/use-content-list";
import type { PublishPlatform } from "@/lib/db/schema";
import { postableVideos } from "@/lib/publish/postable-videos";
import { DEFAULT_CAPTION_BRIEF } from "@/lib/publish/caption-prompt";
import type { ContentDetail } from "@/lib/content/client";

const NO_DESTINATIONS = new Set<PublishPlatform>();

/**
 * The Poster: one finished video, and everywhere it is going.
 *
 * A cross-post is several posts derived from one video, so each destination is
 * its own card with its own caption, its own limits and its own state. The old
 * layout selected a batch with checkboxes but edited whatever video you last
 * clicked, so what you saw was not what you sent.
 *
 * Dropping a file anywhere adds it and opens it, and `?item=` opens one
 * directly, which is how the editor hands a finished cut straight over.
 */
export default function PosterWorkspace() {
  const { isSignedIn } = useUser();
  const { items, prependRow, patchRow } = useContentList(!!isSignedIn, {
    includePosterUploads: true,
  });
  const videos = useMemo(() => postableVideos(items), [items]);
  const { connections } = useConnections(!!isSignedIn);

  const { active, selectedIds, open, toggle } = useVideoSelection(videos);
  const [covers, setCovers] = useState<Record<string, CoverDraft>>({});
  // Per video, because two videos genuinely go to different places and one
  // shared Set could never say so.
  const [destinationsByVideo, setDestinationsByVideo] = useState<
    Record<string, Set<PublishPlatform>>
  >({});
  const [briefsByVideo, setBriefsByVideo] = useState<Record<string, string>>(
    {},
  );
  const matchStyle = true;

  const { byVideo, setCaption, applyGenerated } = useCaptionDrafts();
  const { generating, error, generate } = useCaptionGeneration(applyGenerated);
  const prep = usePublishPrep();

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
    useCallback(
      (item: ContentDetail) => {
        // Publish the returned row into the shared resource immediately. A
        // refetch races the active selection and used to make a successful
        // upload look as though it vanished.
        prependRow(item);
        open(item.id);
      },
      [prependRow, open],
    ),
    useCallback(
      (item: ContentDetail) => {
        patchRow(item.id, item);
      },
      [patchRow],
    ),
  );

  // The editor hands a finished cut over by linking to /studio/poster?item=<id>.
  const params = useSearchParams();
  const requested = params.get("item");
  useEffect(() => {
    if (requested) open(requested);
  }, [requested, open]);

  const cover = active
    ? (covers[active.id] ?? defaultCover(active.title))
    : null;
  const connectedPlatforms = useMemo(
    () => connections?.map((connection) => connection.platform) ?? [],
    [connections],
  );
  const destinations = useMemo(
    () =>
      active
        ? (destinationsByVideo[active.id] ?? new Set(connectedPlatforms))
        : NO_DESTINATIONS,
    [active, connectedPlatforms, destinationsByVideo],
  );
  const brief = active
    ? (briefsByVideo[active.id] ?? DEFAULT_CAPTION_BRIEF)
    : DEFAULT_CAPTION_BRIEF;

  const toggleDestination = useCallback(
    (platform: PublishPlatform) => {
      if (!active) return;
      setDestinationsByVideo((current) => {
        const next = new Set(current[active.id] ?? connectedPlatforms);
        if (next.has(platform)) next.delete(platform);
        else next.add(platform);
        return { ...current, [active.id]: next };
      });
    },
    [active, connectedPlatforms],
  );

  const draftCaptions = () => {
    if (!active) return;
    void generate(
      [active].map((video) => ({
        id: video.id,
        title: video.title,
        // Present for every library take, and it is what lets the server read
        // the script instead of writing from the title alone.
        contentItemId: video.id,
      })),
      [...destinations],
      matchStyle,
      brief,
    );
  };

  return (
    <VideoDropzone onFiles={addFiles}>
      <div className="w-full">
        <PageHeader
          title="Poster"
          description="Drop the final export, generate platform-native copy from what it actually says, and send it everywhere."
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

        {uploadError && (
          <p className="mb-4 text-sm font-semibold text-[color:var(--sg-yellow-500)]">
            {uploadErrorText(uploadError)}
          </p>
        )}

        {uploadState === "uploading" || uploadState === "preparing" ? (
          <div
            role="status"
            aria-live="polite"
            className="border-border bg-card mb-5 overflow-hidden rounded-xl border"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {uploadState === "uploading" ? (
                <UploadCloud className="h-4 w-4 text-[color:var(--sg-accent)]" />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-[color:var(--sg-accent)] motion-reduce:animate-none" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-sm font-semibold">
                  {uploadState === "uploading"
                    ? `Uploading the final export — ${Math.round(uploadProgress * 100)}%`
                    : "Reading the video for smarter captions"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {uploadState === "uploading"
                    ? "You can see exactly how far it has gone."
                    : "The video is already saved. This transcript grounds every platform draft."}
                </p>
              </div>
            </div>
            <div className="h-1 bg-black/20">
              <div
                className="h-full bg-[color:var(--sg-accent)] transition-[width] duration-200"
                style={{
                  width: `${uploadState === "uploading" ? uploadProgress * 100 : 100}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {uploadNotice === "transcript_failed" ? (
          <p className="mb-4 text-sm text-[color:var(--sg-yellow-500)]">
            The video uploaded, but its transcript could not be prepared. You
            can still generate from the title and your writing brief.
          </p>
        ) : null}

        <div className="space-y-8">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
            <Section
              title="Finished videos"
              meta={videos.length ? `${videos.length}` : undefined}
            >
              {items === null ? (
                <p className="text-muted-foreground py-8 text-sm">
                  Loading your finished videos…
                </p>
              ) : (
                <VideoGrid
                  videos={videos}
                  selectedIds={selectedIds}
                  activeId={active?.id ?? null}
                  onAdd={openFilePicker}
                  onOpen={open}
                  onToggle={toggle}
                />
              )}
            </Section>

            <div className="xl:border-border/70 xl:border-l xl:pl-6">
              {active && cover ? (
                <div className="space-y-6">
                  <GenerationBrief
                    value={brief}
                    disabled={generating}
                    onChange={(value) =>
                      setBriefsByVideo((current) => ({
                        ...current,
                        [active.id]: value,
                      }))
                    }
                  />

                  {/* One artwork shared by every destination that shows a
                      chosen thumbnail, so it sits with the video rather than
                      inside any single destination's card. */}
                  <Section title="Cover">
                    <CoverCanvas
                      draft={cover}
                      onChange={(next) =>
                        setCovers((current) => ({
                          ...current,
                          [active.id]: next,
                        }))
                      }
                      onDownload={() => void downloadCover(cover)}
                    />
                  </Section>

                  <DestinationColumn
                    captions={byVideo[active.id]}
                    chosen={destinations}
                    connected={
                      connections?.map((connection) => connection.platform) ??
                      []
                    }
                    hasCover={Boolean(cover.headline.trim())}
                    generating={generating}
                    captionError={error}
                    publishing={prep.preparing}
                    transcriptStatus={active.transcriptStatus}
                    onToggle={toggleDestination}
                    onCaptionChange={(caption) =>
                      setCaption(active.id, caption)
                    }
                    onGenerate={draftCaptions}
                    onPublish={() =>
                      void prep.prepare([active], covers, byVideo)
                    }
                  />
                </div>
              ) : (
                <EmptyState
                  icon={ImageIcon}
                  title="Pick a video to post"
                  description="Drop the MP4 anywhere or choose it from disk. It uploads once, opens automatically, and all connected platforms are selected for you."
                />
              )}
            </div>
          </div>

          <PlatformVideos />
        </div>

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
