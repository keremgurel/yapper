"use client";

import { PLATFORMS } from "@/lib/publish/platforms";
import type { PublishPlatform } from "@/lib/db/schema";
import type { PosterSource } from "./use-source-videos";

const sources = ["uploads", "instagram", "youtube", "tiktok"] as const;

export default function SourceOptions({
  selected,
  onChoose,
  connected,
  onUpload,
  uploadBusy,
}: {
  selected: PosterSource;
  onChoose: (source: PosterSource) => void;
  connected: PublishPlatform[];
  onUpload: () => void;
  uploadBusy: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Video sources"
      className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {sources.map((source) => {
        const upload = source === "uploads";
        const linked = upload || connected.includes(source);
        const picked = !upload && selected === source;
        return (
          <button
            key={source}
            type="button"
            disabled={upload && uploadBusy}
            onClick={upload ? onUpload : () => onChoose(source)}
            aria-pressed={upload ? undefined : picked}
            className={`focus-visible:outline-ring flex min-h-[72px] min-w-0 flex-col items-start justify-center gap-1 rounded-lg border px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${picked ? "border-primary bg-muted" : linked ? "border-border bg-card hover:bg-muted" : "border-border bg-muted text-muted-foreground hover:bg-card"}`}
          >
            <span className="text-sm font-semibold">
              {upload ? "Upload video" : PLATFORMS[source].label}
            </span>
            <span className="text-muted-foreground text-xs">
              {upload ? "From device" : linked ? "Connected" : "Connect"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
