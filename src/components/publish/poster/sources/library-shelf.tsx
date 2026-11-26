"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { PosterVideo } from "../poster-video";
import ShelfNotice from "./shelf-notice";
import ShelfRail from "./shelf-rail";
import SourceShelf from "./source-shelf";

/**
 * Videos that already live in Yapper: uploads waiting to be posted and the
 * latest version of each edited project. The library arrives with the page,
 * so an empty shelf is simply left out rather than held open by a skeleton
 * that would then collapse.
 */
export default function LibraryShelf({
  id,
  title,
  icon,
  videos,
  failed,
  onRetry,
  onOpen,
  onRemoved,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  videos: PosterVideo[];
  failed: boolean;
  onRetry: () => void;
  onOpen: (video: PosterVideo) => void;
  onRemoved?: (id: string) => void;
}) {
  if (!failed && videos.length === 0) return null;
  return (
    <SourceShelf id={id} title={title} icon={icon}>
      {failed ? (
        <ShelfNotice
          alert
          action={
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          }
        >
          Your videos couldn’t be loaded.
        </ShelfNotice>
      ) : (
        <ShelfRail
          label={title}
          videos={videos}
          onOpen={onOpen}
          onRemoved={onRemoved}
        />
      )}
    </SourceShelf>
  );
}
