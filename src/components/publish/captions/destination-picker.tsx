"use client";

import { Chip } from "@/components/studio-ui";
import PlatformIcon from "@/components/publish/platform-icon";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { captionSpec } from "@/lib/publish/caption-specs";

/**
 * Where this post is going. Chosen before the captions are written because the
 * selection is what the caption engine is given: it writes one caption per
 * destination, in that platform's voice, in a single pass so the three stay the
 * same idea rather than drifting into three.
 *
 * All three platforms are offered whether or not they are connected. A caption
 * is worth writing for a platform the creator posts to by hand, and the
 * connection is only checked when something is actually published.
 */
export default function DestinationPicker({
  selected,
  connected,
  disabled,
  onToggle,
}: {
  selected: Set<PublishPlatform>;
  connected: PublishPlatform[];
  disabled?: boolean;
  onToggle: (platform: PublishPlatform) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {publishPlatforms.map((platform) => {
        const active = selected.has(platform);
        return (
          <button
            key={platform}
            type="button"
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onToggle(platform)}
            className={`flex flex-col items-start gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none disabled:opacity-50 ${
              active
                ? "border-[color:var(--sg-accent)] bg-[color-mix(in_oklab,var(--sg-accent)_10%,var(--sg-bg))]"
                : "border-border hover:border-foreground/25"
            }`}
          >
            <span className="text-foreground flex items-center gap-1.5 text-[13px] font-semibold">
              <PlatformIcon
                platform={platform}
                className="h-3.5 w-3.5"
                aria-hidden
              />
              {captionSpec(platform).label}
            </span>
            {connected.includes(platform) ? (
              <Chip tone="green" pill>
                Connected
              </Chip>
            ) : (
              <span className="text-muted-foreground text-xs">
                Not connected
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
