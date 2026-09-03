"use client";

import { Eye, Loader2 } from "lucide-react";
import { canOpen, type PosterVideo } from "../poster-video";

function compactViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function when(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * A post already on a channel. Opening it puts it on the bench to send
 * elsewhere. Posts Yapper has no file for (YouTube and TikTok uploads made
 * outside the app) are shown but cannot be opened, and say so on hover.
 */
export default function PlatformVideoCard({
  video,
  active,
  importing,
  onOpen,
}: {
  video: Extract<PosterVideo, { kind: "platform" }>;
  active: boolean;
  importing: boolean;
  onOpen: () => void;
}) {
  const openable = canOpen(video);
  return (
    <article
      className={`bg-card relative overflow-hidden rounded-xl border transition-colors ${
        active ? "border-[color:var(--sg-accent)]" : "border-border"
      } ${openable ? "" : "opacity-60"}`}
      title={
        openable
          ? undefined
          : "Only videos posted through Yapper can be reposted from here"
      }
    >
      <button
        type="button"
        onClick={onOpen}
        disabled={!openable || importing}
        aria-label={
          openable ? `Repost ${video.title}` : `${video.title} (no source file)`
        }
        className="block w-full text-left focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none disabled:cursor-default"
      >
        <div className="relative aspect-[9/16] overflow-hidden bg-[linear-gradient(160deg,#2a2a2a,#0c0c0c)]">
          {video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <p className="line-clamp-3 text-[13px] leading-snug font-semibold text-white">
              {video.title}
            </p>
          </div>
          {importing ? (
            <div className="absolute inset-0 grid place-items-center bg-black/50">
              <Loader2 className="h-5 w-5 animate-spin text-white motion-reduce:animate-none" />
            </div>
          ) : null}
        </div>
        <div className="text-muted-foreground flex items-center justify-between gap-2 px-3 py-2.5 text-xs">
          <span>{when(video.publishedAt)}</span>
          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
            <Eye aria-hidden className="h-3 w-3" />
            {compactViews(video.viewCount)}
          </span>
        </div>
      </button>
    </article>
  );
}
