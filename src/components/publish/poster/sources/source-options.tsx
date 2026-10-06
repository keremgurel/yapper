"use client";

import { Check, Upload } from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import { PLATFORMS } from "@/lib/publish/platforms";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import type { PosterSource } from "./use-source-videos";

export default function SourceOptions({
  selected,
  onChoose,
  connected,
}: {
  selected: PosterSource;
  onChoose: (source: PosterSource) => void;
  connected: PublishPlatform[];
}) {
  return (
    <nav
      aria-label="Video sources"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5"
    >
      {(["uploads", ...publishPlatforms] as const).map((source) => (
        <button
          key={source}
          type="button"
          onClick={() => onChoose(source)}
          aria-pressed={selected === source}
          className={`focus-visible:outline-ring flex min-h-16 items-center gap-3 rounded-lg border p-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 ${selected === source ? "border-foreground/50 bg-muted" : "border-border hover:bg-muted/50"}`}
        >
          {source === "uploads" ? (
            <Upload aria-hidden className="size-5 shrink-0" />
          ) : (
            <PlatformIcon platform={source} className="size-5 shrink-0" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {source === "uploads" ? "Uploads" : PLATFORMS[source].label}
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">
              {source === "uploads"
                ? "Ready to post"
                : connected.includes(source)
                  ? "Connected"
                  : "Connect account"}
            </span>
          </span>
          {selected === source && (
            <Check aria-hidden className="size-3 shrink-0" />
          )}
        </button>
      ))}
    </nav>
  );
}
