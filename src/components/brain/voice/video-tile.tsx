"use client";

import { Check } from "lucide-react";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PlatformVideo } from "@/lib/publish/client";
import { costLabel, formatDate, formatDuration } from "./platform-copy";

/** One published video in the picker. Already-sampled ones cannot be picked twice. */
export default function VideoTile({
  platform,
  video,
  selected,
  sampled,
  onToggle,
}: {
  platform: PublishPlatform;
  video: PlatformVideo;
  selected: boolean;
  sampled: boolean;
  onToggle: () => void;
}) {
  const duration = formatDuration(video.durationSec ?? null);
  return (
    <button
      type="button"
      disabled={sampled}
      aria-pressed={selected}
      onClick={onToggle}
      className={`group relative flex w-full gap-3 rounded-xl border p-2 text-left transition-colors disabled:cursor-default ${
        selected
          ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/5"
          : "border-border hover:bg-muted/40"
      } ${sampled ? "opacity-55" : ""}`}
    >
      <div className="bg-muted relative h-20 w-[45px] shrink-0 overflow-hidden rounded-md">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnail}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-foreground line-clamp-2 text-sm font-semibold">
          {video.title || "Untitled"}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {[formatDate(video.publishedAt), duration]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {sampled
            ? "Already in your voice"
            : costLabel(platform, video.durationSec)}
        </p>
      </div>
      <span
        aria-hidden="true"
        className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected
            ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
            : "border-border"
        }`}
      >
        {selected ? <Check className="h-3 w-3" /> : null}
      </span>
    </button>
  );
}
