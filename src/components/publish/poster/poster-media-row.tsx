"use client";

import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLATFORMS } from "@/lib/publish/platforms";
import SavedVideoThumbnail from "./saved-video-thumbnail";
import type { PosterVideo } from "./poster-video";
import type { CoverDraft } from "./cover-draft";
import { PosterRow } from "./poster-layout";
import CoverArtwork from "./cover/cover-artwork";

export default function PosterMediaRow({
  video,
  cover,
  locked,
  coverAvailable,
  onBack,
  onCover,
}: {
  video: PosterVideo;
  cover: CoverDraft;
  locked: boolean;
  coverAvailable: boolean;
  onBack: () => void;
  onCover: () => void;
}) {
  return (
    <PosterRow label="Video">
      <div className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 sm:grid-cols-[36px_minmax(0,1fr)_auto]">
        <div className="bg-muted relative grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-md">
          {cover.image ? (
            <CoverArtwork draft={cover} small />
          ) : video.kind === "yapper" && video.submissionId ? (
            <SavedVideoThumbnail submissionId={video.submissionId} />
          ) : video.kind === "platform" && video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Film aria-hidden className="text-muted-foreground size-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold" title={video.title}>
            {video.title}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {video.kind === "platform"
              ? `From ${PLATFORMS[video.platform].label}`
              : "From your library"}
          </p>
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!coverAvailable || locked}
            onClick={onCover}
          >
            Edit cover
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={locked}
            onClick={onBack}
          >
            Change video
          </Button>
        </div>
      </div>
    </PosterRow>
  );
}
