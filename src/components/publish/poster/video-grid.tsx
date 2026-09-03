"use client";

import { EmptyState } from "@/components/studio-ui";
import { Film } from "lucide-react";
import type { PosterVideo } from "@/components/publish/poster/poster-video";
import ConnectTile from "@/components/publish/poster/sources/connect-tile";
import PlatformVideoCard from "@/components/publish/poster/sources/platform-video-card";
import type { PosterSource } from "@/components/publish/poster/sources/use-source-videos";
import UploadTile from "@/components/publish/poster/upload-tile";
import VideoCard from "@/components/publish/poster/video-card";
import VideoGridSkeleton from "@/components/publish/poster/video-grid-skeleton";
import type { AddVideoState } from "@/hooks/use-add-video";

/**
 * The selected source's videos. Yapper's list leads with the upload tile; a
 * channel that is not connected shows the one thing to do about that.
 */
export default function VideoGrid({
  source,
  videos,
  loading,
  connected,
  activeId,
  importingId,
  uploadState,
  uploadProgress,
  onAdd,
  onOpen,
}: {
  source: PosterSource;
  videos: PosterVideo[];
  loading: boolean;
  connected: boolean;
  activeId: string | null;
  importingId: string | null;
  uploadState: AddVideoState;
  uploadProgress: number;
  onAdd: () => void;
  onOpen: (video: PosterVideo) => void;
}) {
  if (source !== "yapper" && !connected && !loading) {
    return <ConnectTile platform={source} />;
  }
  if (loading && videos.length === 0) return <VideoGridSkeleton />;
  if (source !== "yapper" && videos.length === 0) {
    return (
      <EmptyState
        icon={Film}
        title="Nothing posted here yet"
        description="Videos you publish to this channel will appear here, ready to send elsewhere."
      />
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
      {source === "yapper" ? (
        <UploadTile
          state={uploadState}
          progress={uploadProgress}
          onAdd={onAdd}
        />
      ) : null}
      {videos.map((video) =>
        video.kind === "yapper" ? (
          <VideoCard
            key={video.id}
            video={video}
            active={activeId === video.id}
            onOpen={() => void onOpen(video)}
          />
        ) : (
          <PlatformVideoCard
            key={video.id}
            video={video}
            active={activeId === video.id}
            importing={importingId === video.id}
            onOpen={() => void onOpen(video)}
          />
        ),
      )}
    </div>
  );
}
