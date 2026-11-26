"use client";

import { useEffect, useMemo } from "react";
import { Clapperboard, Upload } from "lucide-react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { ContentSummary } from "@/lib/content/client";
import { enabledPublishPlatforms } from "@/lib/publish/availability";
import { posterLibraryVideos } from "@/lib/publish/postable-videos";
import { fromPostable, type PosterVideo } from "../poster-video";
import ChannelShelf from "./channel-shelf";
import LibraryShelf from "./library-shelf";
import { useFileDragging } from "../video-dropzone";
import UploadDropZone from "./upload-drop-zone";

/**
 * Poster's first step. A drop zone for a new file, then a shelf per source
 * with its recent videos, so any of them is one click from the post step.
 */
export default function SourcePicker({
  items,
  libraryFailed,
  connected,
  connectionsLoaded,
  connectionsUnavailable,
  uploadBusy,
  focus,
  onChooseFile,
  onRetryLibrary,
  onOpen,
  onRemoved,
}: {
  items: ContentSummary[] | null;
  libraryFailed: boolean;
  connected: PublishPlatform[];
  connectionsLoaded: boolean;
  connectionsUnavailable: boolean;
  uploadBusy: boolean;
  /** A shelf to bring into view, for example after connecting its account. */
  focus: string | null;
  onChooseFile: () => void;
  onRetryLibrary: () => void;
  onOpen: (video: PosterVideo) => void;
  onRemoved: (id: string) => void;
}) {
  const dragging = useFileDragging();
  const uploads = useMemo(
    () => posterLibraryVideos(items, "uploads").map(fromPostable),
    [items],
  );
  const projects = useMemo(
    () => posterLibraryVideos(items, "yapper").map(fromPostable),
    [items],
  );

  useEffect(() => {
    if (focus)
      document
        .getElementById(`poster-shelf-${focus}`)
        ?.scrollIntoView({ block: "start" });
  }, [connectionsUnavailable, focus]);

  return (
    <section aria-labelledby="poster-source-heading" className="space-y-8">
      <h2 id="poster-source-heading" className="sr-only">
        Choose a video
      </h2>
      <UploadDropZone
        dragging={dragging}
        busy={uploadBusy}
        onChoose={onChooseFile}
      />
      <LibraryShelf
        id="uploads"
        title="Your uploads"
        icon={<Upload aria-hidden className="text-muted-foreground size-4" />}
        videos={uploads}
        failed={false}
        onRetry={onRetryLibrary}
        onOpen={onOpen}
        onRemoved={onRemoved}
      />
      <LibraryShelf
        id="yapper"
        title="Made in Yapper"
        icon={
          <Clapperboard aria-hidden className="text-muted-foreground size-4" />
        }
        videos={projects}
        failed={items === null && libraryFailed}
        onRetry={onRetryLibrary}
        onOpen={onOpen}
      />
      {!connectionsUnavailable &&
        enabledPublishPlatforms.map((platform) => (
          <ChannelShelf
            key={platform}
            platform={platform}
            connected={connected.includes(platform)}
            connectionsLoaded={connectionsLoaded}
            onOpen={onOpen}
          />
        ))}
    </section>
  );
}
