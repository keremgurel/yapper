"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ImageIcon } from "lucide-react";
import { EmptyState, PageHeader, Section } from "@/components/studio-ui";
import CrossPostSheet from "@/components/publish/cross-post-sheet";
import PlatformVideos from "@/components/publish/platform-videos";
import { useCaptionDrafts } from "@/components/publish/captions/use-caption-drafts";
import { useCaptionGeneration } from "@/components/publish/captions/use-caption-generation";
import PosterActions from "@/components/publish/poster/poster-actions";
import DestinationColumn from "@/components/publish/poster/destination-column";
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
  const { items, refresh } = useContentList(!!isSignedIn, {
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
  const matchStyle = true;

  const { byVideo, setCaption, applyGenerated } = useCaptionDrafts();
  const { generating, error, generate } = useCaptionGeneration(applyGenerated);
  const prep = usePublishPrep();

  const {
    ref: fileInputRef,
    state: uploadState,
    error: uploadError,
    onChange: onFilesPicked,
    addFiles,
    open: openFilePicker,
  } = useVideoFiles(
    useCallback(
      (item) => {
        refresh();
        // Straight into composing the thing that was just added, rather than
        // dropping the creator back into a grid to find it again.
        open(item.id);
      },
      [refresh, open],
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
  const destinations = active
    ? (destinationsByVideo[active.id] ?? new Set<PublishPlatform>())
    : new Set<PublishPlatform>();

  const toggleDestination = useCallback(
    (platform: PublishPlatform) => {
      if (!active) return;
      setDestinationsByVideo((current) => {
        const next = new Set(current[active.id] ?? []);
        if (next.has(platform)) next.delete(platform);
        else next.add(platform);
        return { ...current, [active.id]: next };
      });
    },
    [active],
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
    );
  };

  return (
    <VideoDropzone onFiles={addFiles}>
      <div className="w-full">
        <PageHeader
          title="Poster"
          description="Open a finished video, choose where it goes, and send it."
          actions={
            <PosterActions uploadState={uploadState} onAdd={openFilePicker} />
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

        <div className="space-y-8">
          <PlatformVideos />

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
                  description="Its destinations and captions appear here. You can also drop a file anywhere on this page."
                />
              )}
            </div>
          </div>
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
