"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PosterVideo } from "../poster-video";
import ShelfTile from "./shelf-tile";
import { useRailScroll } from "./use-rail-scroll";

/** Enough to choose from without loading a channel's whole history. */
const SHELF_LIMIT = 24;

/**
 * A source's recent videos in one horizontally scrolling row. Touch and
 * trackpads scroll it directly; a mouse gets a button at each end that has
 * more to show.
 */
export default function ShelfRail({
  videos,
  label,
  onOpen,
  onRemoved,
}: {
  videos: PosterVideo[];
  label: string;
  onOpen: (video: PosterVideo) => void;
  onRemoved?: (id: string) => void;
}) {
  const { ref, edges, step } = useRailScroll<HTMLUListElement>();
  const arrow = (direction: 1 | -1) => (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label={direction > 0 ? `More from ${label}` : `Back in ${label}`}
      onClick={() => step(direction)}
      className={`absolute top-[calc(50%-1.5rem)] z-10 hidden -translate-y-1/2 pointer-fine:inline-flex ${direction > 0 ? "-right-3" : "-left-3"}`}
    >
      {direction > 0 ? (
        <ChevronRight aria-hidden />
      ) : (
        <ChevronLeft aria-hidden />
      )}
    </Button>
  );
  return (
    <div className="relative">
      <ul
        ref={ref}
        aria-label={label}
        className="flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-width:none] pointer-coarse:[scrollbar-width:auto] [&::-webkit-scrollbar]:hidden"
      >
        {videos.slice(0, SHELF_LIMIT).map((video) => (
          <ShelfTile
            key={video.id}
            video={video}
            onOpen={() => onOpen(video)}
            onRemoved={onRemoved}
          />
        ))}
      </ul>
      {edges.back ? arrow(-1) : null}
      {edges.forward ? arrow(1) : null}
    </div>
  );
}
