"use client";

import { Eye, Heart, MessageCircle, Sparkles, TrendingUp } from "lucide-react";
import { formatCount } from "@/lib/inspiration/format";
import type { ScrapedVideo } from "@/lib/inspiration/types";

function Stat({ icon: Icon, value }: { icon: typeof Eye; value: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {formatCount(value)}
    </span>
  );
}

/** A single scraped video in the creator carousel: thumbnail, an outlier ribbon
 * when it overperformed, view/like/comment counts, and (when `onRemix` is given)
 * a hover "Make your own" button that opens the create-from-clip chat. */
export default function VideoStatCard({
  video,
  onRemix,
}: {
  video: ScrapedVideo;
  onRemix?: () => void;
}) {
  return (
    <div className="t-lift group border-border bg-card relative block w-44 shrink-0 overflow-hidden rounded-xl border shadow-sm hover:shadow-md sm:w-48">
      <a
        href={video.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        <div className="bg-muted relative aspect-[9/16]">
          {video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="text-foreground/30 flex h-full w-full items-center justify-center text-xs font-bold">
              No preview
            </div>
          )}

          {video.isOutlier && (
            <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-[color:var(--sg-accent)] px-2 py-0.5 text-[10px] font-black text-white shadow-sm">
              <TrendingUp className="h-3 w-3" />
              {video.outlierScore
                ? `${video.outlierScore.toFixed(1)}×`
                : "Outlier"}
            </span>
          )}

          {/* Stats overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
            <div className="flex items-center gap-2.5 text-[11px] font-bold text-white">
              <Stat icon={Eye} value={video.views} />
              <Stat icon={Heart} value={video.likes} />
              <Stat icon={MessageCircle} value={video.comments} />
            </div>
          </div>
        </div>
      </a>

      {onRemix && (
        <button
          type="button"
          onClick={onRemix}
          className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-black text-black opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:bg-white"
        >
          <Sparkles className="h-3 w-3" />
          Make your own
        </button>
      )}

      {video.title && (
        <p className="text-foreground/80 line-clamp-2 px-2.5 py-2 text-xs leading-snug">
          {video.title}
        </p>
      )}
    </div>
  );
}
