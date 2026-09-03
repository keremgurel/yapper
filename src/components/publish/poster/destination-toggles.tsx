"use client";

import { Check, Link2 } from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";

/**
 * Where this video goes. One row of the three platforms: chosen, available,
 * or not connected yet. A platform that is not connected connects from right
 * here, so cross-posting never detours through a settings page.
 */
export default function DestinationToggles({
  chosen,
  connected,
  onToggle,
  onConnect,
}: {
  chosen: Set<PublishPlatform>;
  connected: PublishPlatform[];
  onToggle: (platform: PublishPlatform) => void;
  onConnect: (platform: PublishPlatform) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="group"
      aria-label="Destinations"
    >
      {publishPlatforms.map((platform) => {
        const label = PLATFORMS[platform].label;
        const isConnected = connected.includes(platform);
        const on = chosen.has(platform);
        if (!isConnected) {
          return (
            <button
              key={platform}
              type="button"
              onClick={() => onConnect(platform)}
              className="bg-muted text-muted-foreground hover:text-foreground flex min-h-10 items-center justify-center gap-2 rounded-lg px-2 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
            >
              <Link2 aria-hidden className="h-3.5 w-3.5" />
              Connect {label}
            </button>
          );
        }
        return (
          <button
            key={platform}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(platform)}
            className={`flex min-h-10 items-center justify-center gap-2 rounded-lg border px-2 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              on
                ? "bg-card text-foreground border-[color:var(--sg-accent)]"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {on ? (
              <Check
                aria-hidden
                className="h-3.5 w-3.5 text-[color:var(--sg-accent)]"
              />
            ) : (
              <PlatformIcon platform={platform} className="h-3.5 w-3.5" />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}
