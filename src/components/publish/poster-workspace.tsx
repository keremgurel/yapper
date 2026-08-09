"use client";

import { useCallback, useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/studio-ui";
import CrossPostSheet from "@/components/publish/cross-post-sheet";
import PlatformVideos from "@/components/publish/platform-videos";
import { useCaptionDrafts } from "@/components/publish/captions/use-caption-drafts";
import { useCaptionGeneration } from "@/components/publish/captions/use-caption-generation";
import PosterActions from "@/components/publish/poster/poster-actions";
import PrepareRail from "@/components/publish/poster/prepare-rail";
import VideoGrid from "@/components/publish/poster/video-grid";
import {
  defaultCover,
  type CoverDraft,
} from "@/components/publish/poster/cover-draft";
import { downloadCover } from "@/components/publish/poster/render-cover";
import { uploadErrorText } from "@/components/publish/poster/upload-error";
import { usePublishPrep } from "@/components/publish/poster/use-publish-prep";
import { useSchedule } from "@/components/publish/poster/use-schedule";
import { useVideoFiles } from "@/components/publish/poster/use-video-files";
import { useVideoSelection } from "@/components/publish/poster/use-video-selection";
import { useConnections } from "@/hooks/use-connections";
import { useContentList } from "@/hooks/use-content-list";
import type { PublishPlatform } from "@/lib/db/schema";
import { postableVideos } from "@/lib/publish/postable-videos";

/**
 * The Poster: pick finished videos, say where each is going, write the caption
 * each platform actually wants, then publish. Destinations come first because
 * they are what the caption engine is given; the three captions are written
 * together, in one pass, so they stay the same idea in three voices.
 */
export default function PosterWorkspace() {
  const { isSignedIn } = useUser();
  const { items, refresh, patchRow } = useContentList(!!isSignedIn, {
    includePosterUploads: true,
  });
  const videos = useMemo(() => postableVideos(items), [items]);
  const { connections } = useConnections(!!isSignedIn);

  const { active, selected, selectedIds, open, toggle, toggleAll } =
    useVideoSelection(videos);
  const [covers, setCovers] = useState<Record<string, CoverDraft>>({});
  const [destinations, setDestinations] = useState<Set<PublishPlatform>>(
    new Set(),
  );
  const [matchStyle, setMatchStyle] = useState(true);

  const { byVideo, setCaption, applyGenerated } = useCaptionDrafts();
  const { generating, error, generate } = useCaptionGeneration(applyGenerated);
  const schedule = useSchedule(patchRow);
  const prep = usePublishPrep();

  const {
    ref: fileInputRef,
    state: uploadState,
    error: uploadError,
    onChange: onFilesPicked,
    open: openFilePicker,
  } = useVideoFiles(refresh);

  // Everything in the rail acts on the selection, falling back to the video
  // being looked at, so a creator who never ticks a box is not stuck.
  const batch = selected.length > 0 ? selected : active ? [active] : [];
  const cover = active
    ? (covers[active.id] ?? defaultCover(active.title))
    : null;

  const toggleDestination = useCallback((platform: PublishPlatform) => {
    setDestinations((current) => {
      const next = new Set(current);
      if (next.has(platform)) next.delete(platform);
      else next.add(platform);
      return next;
    });
  }, []);

  const draftCaptions = () => {
    void generate(
      batch.map((video) => ({
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
    <div className="w-full">
      <PageHeader
        title="Poster"
        description="Prepare a finished video for each place it is going, then publish or schedule it."
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
            action={
              videos.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleAll}
                >
                  {selectedIds.size === videos.length
                    ? "Clear selection"
                    : "Select all"}
                </Button>
              )
            }
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
              <PrepareRail
                video={active}
                selectedCount={batch.length}
                destinations={{
                  selected: destinations,
                  connected:
                    connections?.map((connection) => connection.platform) ?? [],
                  onToggle: toggleDestination,
                }}
                captions={{
                  set: byVideo[active.id],
                  generating,
                  error,
                  matchStyle,
                  onMatchStyle: setMatchStyle,
                  onGenerate: draftCaptions,
                  onChange: (caption) => setCaption(active.id, caption),
                }}
                cover={{
                  draft: cover,
                  onChange: (next) =>
                    setCovers((current) => ({ ...current, [active.id]: next })),
                  onDownload: () => void downloadCover(cover),
                }}
                schedule={{
                  at: schedule.at,
                  spacing: schedule.spacing,
                  state: schedule.state,
                  onAt: schedule.setAt,
                  onSpacing: schedule.setSpacing,
                  onSchedule: () => void schedule.schedule(batch),
                }}
                publish={{
                  preparing: prep.preparing,
                  warning: prep.warning,
                  onPublish: () => void prep.prepare(batch, covers, byVideo),
                }}
              />
            ) : (
              <EmptyState
                icon={ImageIcon}
                title="Pick a video to prepare"
                description="Its destinations, captions, cover and schedule appear here."
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
  );
}
