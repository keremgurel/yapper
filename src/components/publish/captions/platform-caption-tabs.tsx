"use client";

import { AlertTriangle } from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import {
  captionFor,
  hasCaptionText,
  type CaptionSet,
} from "@/components/publish/captions/caption-draft";
import type { PublishPlatform } from "@/lib/db/schema";
import { captionFits } from "@/lib/publish/caption";
import { captionSpec } from "@/lib/publish/caption-specs";

export const tabId = (platform: PublishPlatform) => `caption-tab-${platform}`;
export const panelId = (platform: PublishPlatform) =>
  `caption-panel-${platform}`;

/**
 * One tab per destination, because the three captions are three different
 * artifacts. Reusing one box for all of them is the thing this replaces, so the
 * tab strip also says which platforms still have nothing written.
 */
export default function PlatformCaptionTabs({
  platforms,
  active,
  captions,
  onSelect,
}: {
  platforms: PublishPlatform[];
  active: PublishPlatform;
  captions: CaptionSet | undefined;
  onSelect: (platform: PublishPlatform) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Caption per platform"
      className="flex gap-1"
    >
      {platforms.map((platform) => {
        const caption = captionFor(captions, platform);
        const written = hasCaptionText(caption);
        const rejected = written && !captionFits(caption);
        const selected = platform === active;

        return (
          <button
            key={platform}
            type="button"
            role="tab"
            id={tabId(platform)}
            aria-selected={selected}
            aria-controls={panelId(platform)}
            onClick={() => onSelect(platform)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              selected
                ? "text-foreground border-[color:var(--sg-accent)]"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            <PlatformIcon
              platform={platform}
              className="h-3.5 w-3.5"
              aria-hidden
            />
            {captionSpec(platform).label}
            {rejected ? (
              <>
                <AlertTriangle
                  aria-hidden
                  className="h-3 w-3 text-[color:var(--sg-yellow-500)]"
                />
                <span className="sr-only">too long for this platform</span>
              </>
            ) : (
              !written && (
                <>
                  <span
                    aria-hidden
                    className="bg-muted-foreground h-1.5 w-1.5 rounded-full"
                  />
                  <span className="sr-only">not written yet</span>
                </>
              )
            )}
          </button>
        );
      })}
    </div>
  );
}
