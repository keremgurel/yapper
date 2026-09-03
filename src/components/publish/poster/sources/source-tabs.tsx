"use client";

import PlatformIcon from "@/components/publish/platform-icon";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { PosterSource } from "./use-source-videos";

/**
 * Where the video comes from. "Yapper" is what you made here; each platform
 * tab is what you already posted there, so reposting a Reel to YouTube starts
 * by clicking Instagram. A dot marks a connected channel.
 */
export default function SourceTabs({
  source,
  connected,
  onChange,
}: {
  source: PosterSource;
  connected: PublishPlatform[];
  onChange: (source: PosterSource) => void;
}) {
  const tab = (
    key: PosterSource,
    label: React.ReactNode,
    dot?: "on" | "off",
  ) => {
    const active = source === key;
    return (
      <button
        key={key}
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => onChange(key)}
        className={`relative flex h-9 items-center gap-2 px-3 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
          active
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        {label}
        {dot ? (
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              dot === "on"
                ? "bg-[color:var(--sg-green-500)]"
                : "bg-muted-foreground/35"
            }`}
          />
        ) : null}
        {active ? (
          <span
            aria-hidden
            className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[color:var(--sg-accent)]"
          />
        ) : null}
      </button>
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Video source"
      className="border-border/70 flex flex-wrap items-center border-b"
    >
      {tab("yapper", "Made in Yapper")}
      {publishPlatforms.map((platform) =>
        tab(
          platform,
          <>
            <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
            {PLATFORMS[platform].label}
          </>,
          connected.includes(platform) ? "on" : "off",
        ),
      )}
    </div>
  );
}
