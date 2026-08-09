"use client";

import { Chip } from "@/components/studio-ui";
import PlatformIcon from "@/components/publish/platform-icon";
import CaptionLine from "@/components/publish/captions/caption-line";
import CopyCaptionButton from "@/components/publish/captions/copy-caption-button";
import { hasCaptionText } from "@/components/publish/captions/caption-draft";
import type { CrossPostTarget } from "@/components/publish/compose/types";
import { publishPlatforms } from "@/lib/db/schema";
import { captionSpec } from "@/lib/publish/caption-specs";

/**
 * What is about to go out, per video and per platform, exactly as written in
 * the Poster. Read-only on purpose: editing happens where the constraints are
 * shown, and a second editable copy here is how the two drift apart.
 */
export default function PreparedCaptions({
  sources,
}: {
  sources: CrossPostTarget[];
}) {
  return (
    <div className="flex flex-col gap-5">
      {sources.map((source) => {
        const written = publishPlatforms.filter((platform) => {
          const caption = source.captions?.[platform];
          return caption && hasCaptionText(caption);
        });

        return (
          <div key={source.id}>
            {sources.length > 1 && (
              <p className="text-foreground mb-2 truncate text-sm font-medium">
                {source.title}
              </p>
            )}
            {written.length === 0 && (
              // Named rather than omitted: a video silently missing from this
              // list still publishes, and it would publish with no caption.
              <p className="text-muted-foreground text-[13px]">
                No caption written. This one posts with its cover text as the
                title and nothing else.
              </p>
            )}
            <div className="divide-border/60 flex flex-col divide-y">
              {written.map((platform) => {
                const caption = source.captions?.[platform];
                if (!caption) return null;
                const spec = captionSpec(platform);

                return (
                  <div
                    key={platform}
                    className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformIcon
                        platform={platform}
                        className="text-muted-foreground h-3.5 w-3.5"
                        aria-hidden
                      />
                      <span className="text-foreground text-[13px] font-semibold">
                        {spec.label}
                      </span>
                      {!spec.postable && (
                        <Chip tone="yellow" pill>
                          Copy only
                        </Chip>
                      )}
                      <span className="ml-auto">
                        <CopyCaptionButton
                          caption={caption}
                          label={
                            spec.postable ? "Copy" : `Copy for ${spec.label}`
                          }
                          variant={spec.postable ? "ghost" : "outline"}
                        />
                      </span>
                    </div>
                    {spec.hasTitle && caption.title && (
                      <p className="text-foreground text-[13px] font-medium">
                        {caption.title}
                      </p>
                    )}
                    <CaptionLine caption={caption} />
                    {!spec.postable && (
                      <p className="text-muted-foreground text-xs">
                        Goes to your {spec.label} drafts without this caption.
                        Paste it in the app.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
