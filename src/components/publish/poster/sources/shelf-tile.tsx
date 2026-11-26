"use client";

import { Eye, Film } from "lucide-react";
import RemoveUpload from "../remove-upload";
import SavedVideoThumbnail from "../saved-video-thumbnail";
import { canOpen, needsOriginal, type PosterVideo } from "../poster-video";
import { compactViews, shortDate } from "./shelf-format";

/** One video on a source shelf, portrait like the video. Clicking opens it. */
export default function ShelfTile({
  video,
  onOpen,
  onRemoved,
}: {
  video: PosterVideo;
  onOpen: () => void;
  onRemoved?: (id: string) => void;
}) {
  const openable = canOpen(video);
  return (
    <li className="relative w-[112px] shrink-0 snap-start sm:w-[128px]">
      <button
        type="button"
        onClick={onOpen}
        disabled={!openable}
        title={
          openable
            ? video.title
            : "Only videos posted through Yapper can be reposted from here"
        }
        aria-label={
          needsOriginal(video)
            ? `Attach original video for ${video.title}`
            : `Use ${video.title}`
        }
        className="group block w-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sg-accent)] disabled:cursor-default disabled:opacity-50"
      >
        <span className="bg-muted relative block aspect-[9/16] overflow-hidden rounded-2xl after:pointer-events-none after:absolute after:inset-0 after:rounded-2xl after:ring-1 after:ring-black/10 after:transition-shadow after:ring-inset group-enabled:group-hover:after:ring-2 group-enabled:group-hover:after:ring-[color:var(--sg-accent)] dark:after:ring-white/10">
          {video.kind === "yapper" ? (
            <SavedVideoThumbnail submissionId={video.submissionId} />
          ) : video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="text-muted-foreground absolute inset-0 grid place-items-center">
              <Film aria-hidden className="size-5" />
            </span>
          )}
        </span>
        <span className="text-foreground mt-2 line-clamp-2 text-xs leading-snug font-medium">
          {video.title}
        </span>
        {video.kind === "platform" ? (
          <span className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-xs">
            {needsOriginal(video) ? (
              <span>Attach original</span>
            ) : (
              <>
                <span>{shortDate(video.publishedAt)}</span>
                {video.insightsAvailable === false ? null : (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Eye aria-hidden className="size-3" />
                    {compactViews(video.viewCount)}
                  </span>
                )}
              </>
            )}
          </span>
        ) : null}
      </button>
      {onRemoved && video.kind === "yapper" ? (
        <RemoveUpload
          id={video.contentItemId}
          title={video.title}
          onRemoved={onRemoved}
          compact
        />
      ) : null}
    </li>
  );
}
