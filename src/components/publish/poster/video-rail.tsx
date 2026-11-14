"use client";

import { Film } from "lucide-react";
import { canOpen, needsOriginal, type PosterVideo } from "./poster-video";
import SavedVideoThumbnail from "./saved-video-thumbnail";
import RemoveUpload from "./remove-upload";

export default function VideoRail({
  videos,
  onOpen,
  onRemoved,
}: {
  videos: PosterVideo[];
  onOpen: (video: PosterVideo) => void;
  onRemoved?: (id: string) => void;
}) {
  return (
    <ul className="border-border divide-border divide-y border-y">
      {videos.map((video) => (
        <li key={video.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(video)}
            disabled={!canOpen(video)}
            className="focus-visible:ring-ring hover:bg-muted flex min-h-16 min-w-0 flex-1 items-center gap-3 rounded-sm py-2 text-left focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          >
            <span className="bg-muted relative grid h-12 w-8 shrink-0 place-items-center overflow-hidden rounded-sm">
              {video.kind === "yapper" ? (
                <SavedVideoThumbnail submissionId={video.submissionId} />
              ) : video.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnail}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <Film aria-hidden className="text-muted-foreground size-4" />
              )}
            </span>
            <span className="line-clamp-2 min-w-0 flex-1 text-sm font-medium">
              {video.title}
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {needsOriginal(video) ? "Attach original" : "Use video"}
            </span>
          </button>
          {onRemoved && video.kind === "yapper" ? (
            <RemoveUpload
              id={video.contentItemId}
              title={video.title}
              onRemoved={onRemoved}
              inline
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
