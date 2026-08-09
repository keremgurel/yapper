"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/studio-ui";
import VideoCard from "@/components/publish/poster/video-card";
import type { PostableVideo } from "@/lib/publish/postable-videos";

/** The finished videos, as a selectable grid. */
export default function VideoGrid({
  videos,
  selectedIds,
  activeId,
  onAdd,
  onOpen,
  onToggle,
}: {
  videos: PostableVideo[];
  selectedIds: Set<string>;
  activeId: string | null;
  onAdd: () => void;
  onOpen: (id: string) => void;
  onToggle: (video: PostableVideo) => void;
}) {
  if (videos.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="Add your first finished video"
        description="Record in Yapper or upload a video edited elsewhere, and it lands here ready to prepare."
        action={
          <Button type="button" onClick={onAdd}>
            Add videos
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          selected={selectedIds.has(video.id)}
          active={activeId === video.id}
          onToggle={() => onToggle(video)}
          onOpen={() => onOpen(video.id)}
        />
      ))}
    </div>
  );
}
