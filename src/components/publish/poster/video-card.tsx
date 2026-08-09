"use client";

import { Check, ChevronRight } from "lucide-react";
import { Chip, statusTone } from "@/components/studio-ui";
import type { PostableVideo } from "@/lib/publish/postable-videos";

function readableDate(iso: string | null): string {
  if (!iso) return "Not scheduled";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One finished video, selectable for a batch and openable for preparing.
 * Selection is the only accent on the card, because selection is what orange
 * means. */
export default function VideoCard({
  video,
  selected,
  active,
  onToggle,
  onOpen,
}: {
  video: PostableVideo;
  selected: boolean;
  active: boolean;
  onToggle: () => void;
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
        className="block w-full text-left focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
      >
        <div className="relative aspect-[16/9] overflow-hidden bg-[linear-gradient(145deg,#202020,#090909)]">
          <div className="absolute inset-0 grid place-items-center px-6">
            <span className="line-clamp-3 text-center text-[13px] leading-tight font-semibold text-white">
              {video.title}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 pr-10">
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">
              {video.title}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {readableDate(video.scheduledFor)}
            </p>
          </div>
          <Chip tone={statusTone(video.status)} pill>
            {video.status}
          </Chip>
        </div>
      </button>

      <button
        type="button"
        aria-label={
          selected ? `Deselect ${video.title}` : `Select ${video.title}`
        }
        aria-pressed={selected}
        onClick={onToggle}
        className={`absolute top-2.5 left-2.5 grid h-7 w-7 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
          selected
            ? "bg-[color:var(--sg-accent)] text-black"
            : "bg-black/50 text-white/60 hover:text-white"
        }`}
      >
        <Check aria-hidden className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Prepare ${video.title}`}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute right-2 bottom-2.5 grid h-8 w-8 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
      >
        <ChevronRight aria-hidden className="h-4 w-4" />
      </button>
    </article>
  );
}
