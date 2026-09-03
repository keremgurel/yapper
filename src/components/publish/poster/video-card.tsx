"use client";

import { Chip, statusTone } from "@/components/studio-ui";
import type { PosterVideo } from "@/components/publish/poster/poster-video";

function readableDate(iso: string | null): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One finished Yapper take, portrait like the video itself. The whole card
 * opens it. Orange means open, and nothing else on the card is colored. */
export default function VideoCard({
  video,
  active,
  onOpen,
}: {
  video: Extract<PosterVideo, { kind: "yapper" }>;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className={`bg-card relative overflow-hidden rounded-xl border transition-colors ${
        active ? "border-[color:var(--sg-accent)]" : "border-border"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Prepare ${video.title}`}
        className="block w-full text-left focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
      >
        <div className="relative aspect-[9/16] overflow-hidden bg-[linear-gradient(160deg,#2a2a2a,#0c0c0c)]">
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <p className="line-clamp-3 text-[13px] leading-snug font-semibold text-white">
              {video.title}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <p className="text-muted-foreground truncate text-xs">
            {readableDate(video.scheduledFor)}
          </p>
          <Chip tone={statusTone(video.status)} pill>
            {video.status}
          </Chip>
        </div>
      </button>
    </article>
  );
}
