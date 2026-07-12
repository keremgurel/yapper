"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Eye, Loader2, Lock } from "lucide-react";
import { useYouTubeVideos, type VideoSort } from "@/hooks/use-youtube-videos";
import type { PlatformVideo } from "@/lib/publish/client";

function compactViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function when(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const SORTS: { key: VideoSort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "views", label: "Most viewed" },
];

/** Your YouTube uploads as a grid, sortable by recency or views. The first
 * column of the content hub; TikTok/Instagram join it as they're connected. */
export default function YouTubeVideos() {
  const { isSignedIn } = useUser();
  const [sort, setSort] = useState<VideoSort>("recent");
  const { videos, connected } = useYouTubeVideos(!!isSignedIn, sort);

  if (!connected && videos !== null) return null; // not linked → connect strip covers it

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-foreground text-lg font-black tracking-tight">
          Your YouTube videos
        </h2>
        <div className="bg-muted/60 flex rounded-lg p-0.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSort(s.key)}
              className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
                sort === s.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {videos === null ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your videos…
        </div>
      ) : videos.length === 0 ? (
        <p className="text-muted-foreground py-10 text-sm">
          No videos on this channel yet.
        </p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </section>
  );
}

function VideoCard({ video }: { video: PlatformVideo }) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noreferrer"
      className="group border-border bg-card block overflow-hidden rounded-xl border no-underline transition-colors hover:border-[color:var(--sg-accent)]/50"
    >
      <div className="bg-muted relative aspect-[9/16]">
        {video.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {video.privacyStatus !== "public" && (
          <span className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-black text-white capitalize">
            <Lock className="h-2.5 w-2.5" />
            {video.privacyStatus}
          </span>
        )}
      </div>
      <div className="p-2">
        <p className="text-foreground line-clamp-2 text-xs font-bold">
          {video.title}
        </p>
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
          <Eye className="h-3 w-3" />
          {compactViews(video.viewCount)} · {when(video.publishedAt)}
        </p>
      </div>
    </a>
  );
}
