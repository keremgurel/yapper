"use client";

import { Loader2, Plus } from "lucide-react";
import { Chip, statusTone } from "@/components/studio-ui";
import {
  canOpen,
  type PosterVideo,
} from "@/components/publish/poster/poster-video";
import type { PosterSource } from "@/components/publish/poster/sources/use-source-videos";

/**
 * The selected source's videos as a bin beside the work. Once a video is open
 * the grid would only repeat what the creator already chose, so the list
 * shrinks to rows: the open one is marked, any other is one click away.
 */
export default function VideoRail({
  source,
  videos,
  activeId,
  importingId,
  onOpen,
  onAdd,
}: {
  source: PosterSource;
  videos: PosterVideo[];
  activeId: string | null;
  importingId: string | null;
  onOpen: (video: PosterVideo) => void;
  onAdd: () => void;
}) {
  return (
    <div className="bg-card border-border divide-border/60 divide-y overflow-hidden rounded-xl border">
      {source === "yapper" ? (
        <button
          type="button"
          onClick={onAdd}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
        >
          <span className="bg-muted grid h-9 w-6 shrink-0 place-items-center rounded-md">
            <Plus aria-hidden className="h-3.5 w-3.5" />
          </span>
          Add a finished video
        </button>
      ) : null}
      {videos.map((video) => {
        const active = video.id === activeId;
        const openable = canOpen(video);
        return (
          <button
            key={video.id}
            type="button"
            onClick={() => void onOpen(video)}
            disabled={!openable}
            aria-current={active ? "true" : undefined}
            className={`flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              active ? "bg-muted" : "hover:bg-muted/60"
            } ${openable ? "" : "opacity-50"}`}
          >
            <span className="relative h-9 w-6 shrink-0 overflow-hidden rounded-md bg-[linear-gradient(160deg,#2a2a2a,#0c0c0c)]">
              {video.kind === "platform" && video.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={video.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
              {importingId === video.id ? (
                <span className="absolute inset-0 grid place-items-center bg-black/50">
                  <Loader2 className="h-3 w-3 animate-spin text-white motion-reduce:animate-none" />
                </span>
              ) : null}
            </span>
            <span
              className={`text-foreground min-w-0 flex-1 truncate text-[13px] ${
                active ? "font-semibold" : "font-medium"
              }`}
            >
              {video.title}
            </span>
            {video.kind === "yapper" ? (
              <Chip tone={statusTone(video.status)} pill>
                {video.status}
              </Chip>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
