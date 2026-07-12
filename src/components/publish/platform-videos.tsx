"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ChevronDown, Eye, Loader2, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useYouTubeVideos, type VideoSort } from "@/hooks/use-youtube-videos";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { PlatformVideo } from "@/lib/publish/client";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

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

/**
 * Your videos on one platform, chosen from a dropdown. YouTube is live (real
 * uploads, sortable by recency or views); TikTok and Instagram are placeholders
 * until their listing is wired. The first step toward the cross-platform matrix.
 */
export default function PlatformVideos() {
  const [platform, setPlatform] = useState<PublishPlatform>("youtube");
  const [sort, setSort] = useState<VideoSort>("recent");

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-foreground flex items-center gap-1 text-lg font-black tracking-tight">
          Your
          <DropdownMenu>
            <DropdownMenuTrigger className="hover:text-foreground/80 flex items-center gap-1 text-[color:var(--sg-accent)] outline-none">
              {PLATFORMS[platform].label}
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {publishPlatforms.map((p) => (
                <DropdownMenuItem
                  key={p}
                  onClick={() => setPlatform(p)}
                  className="font-bold"
                >
                  {PLATFORMS[p].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          videos
        </h2>
        {platform === "youtube" && (
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
        )}
      </div>

      {platform === "youtube" ? (
        <YouTubeGrid sort={sort} />
      ) : (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed py-12 text-center text-sm">
          {PLATFORMS[platform].label} videos are coming soon.
        </div>
      )}
    </section>
  );
}

function YouTubeGrid({ sort }: { sort: VideoSort }) {
  const { isSignedIn } = useUser();
  const { videos, connected } = useYouTubeVideos(!!isSignedIn, sort);

  if (!connected && videos !== null) {
    return (
      <p className="text-muted-foreground py-10 text-sm">
        Connect YouTube above to see your videos here.
      </p>
    );
  }
  if (videos === null) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your videos…
      </div>
    );
  }
  if (videos.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-sm">
        No videos on this channel yet.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
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
