"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ChevronDown, Eye, Loader2, Lock, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import { usePlatformVideos, type VideoSort } from "@/hooks/use-platform-videos";
import { PLATFORMS } from "@/lib/publish/platforms";
import { importInstagramMedia, type PlatformVideo } from "@/lib/publish/client";
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
 * Your videos on one platform, chosen from a dropdown. YouTube (sortable by
 * recency or views) and Instagram list real uploads; TikTok's API will not
 * return a user's posted videos, so it shows a note instead. Instagram rows
 * carry a downloadable file, so they get a Cross-post action that pulls the
 * video into storage and opens the compose sheet for the other platforms.
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

      {platform === "tiktok" ? (
        <div className="text-muted-foreground border-border rounded-xl border border-dashed py-12 text-center text-sm">
          TikTok does not let apps pull your posted videos back out, so they
          cannot be listed here. TikTok stays a cross-post destination.
        </div>
      ) : (
        <PlatformGrid key={platform} platform={platform} sort={sort} />
      )}
    </section>
  );
}

function PlatformGrid({
  platform,
  sort,
}: {
  platform: PublishPlatform;
  sort: VideoSort;
}) {
  const { isSignedIn } = useUser();
  const { videos, connected } = usePlatformVideos(platform, !!isSignedIn, sort);
  const [target, setTarget] = useState<CrossPostTarget | null>(null);
  const label = PLATFORMS[platform].label;

  if (!connected && videos !== null) {
    return (
      <p className="text-muted-foreground py-10 text-sm">
        Connect {label} above to see your videos here.
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
      <p className="text-muted-foreground py-10 text-sm">No videos here yet.</p>
    );
  }
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} onCrossPost={setTarget} />
        ))}
      </div>
      {target && (
        <CrossPostSheet
          key={target.id}
          item={target}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  );
}

function VideoCard({
  video,
  onCrossPost,
}: {
  video: PlatformVideo;
  onCrossPost: (target: CrossPostTarget) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState(false);
  // Only Instagram rows carry a downloadable file we can re-post from.
  const canCrossPost = Boolean(video.sourceFileUrl);

  const startCrossPost = async () => {
    if (importing) return;
    setImporting(true);
    setFailed(false);
    try {
      const { mediaKey, title } = await importInstagramMedia(video.id);
      onCrossPost({
        id: `import-${video.id}`,
        title: title || video.title,
        mediaKey,
      });
    } catch {
      setFailed(true);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="group border-border bg-card relative overflow-hidden rounded-xl border transition-colors hover:border-[color:var(--sg-accent)]/50">
      <a
        href={video.url}
        target="_blank"
        rel="noreferrer"
        className="block no-underline"
      >
        {/* Cropped square-ish frame, like Instagram's grid, so tall reel covers
            do not leave big black bars. */}
        <div className="bg-muted relative aspect-[4/5]">
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
      </a>

      {canCrossPost && (
        <button
          type="button"
          onClick={startCrossPost}
          disabled={importing}
          title={failed ? "Import failed, tap to retry" : "Cross-post"}
          aria-label="Cross-post this video"
          className={`bg-foreground text-background absolute top-2 right-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-90 disabled:opacity-70 ${
            failed ? "bg-red-600 text-white" : ""
          }`}
        >
          {importing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      )}

      <div className="p-2">
        <p className="text-foreground line-clamp-2 text-xs font-bold">
          {video.title}
        </p>
        <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[11px]">
          {video.viewCount > 0 ? (
            <>
              <Eye className="h-3 w-3" />
              {compactViews(video.viewCount)} · {when(video.publishedAt)}
            </>
          ) : (
            when(video.publishedAt)
          )}
        </p>
      </div>
    </div>
  );
}
