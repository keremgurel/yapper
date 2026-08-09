"use client";

import { Chip } from "@/components/studio-ui";
import CopyCaptionButton from "@/components/publish/captions/copy-caption-button";
import type { PlatformCaption } from "@/lib/publish/caption";
import { captionSpec } from "@/lib/publish/caption-specs";

/**
 * How this caption reaches the platform, said plainly.
 *
 * TikTok publishes through the inbox endpoint, which lands the video in the
 * creator's drafts and accepts no caption at all. Its text exists to be pasted
 * in the TikTok app, and the UI has to say so: a caption box that silently does
 * nothing is worse than no caption box.
 */
export default function CaptionDelivery({
  caption,
}: {
  caption: PlatformCaption;
}) {
  const spec = captionSpec(caption.platform);

  if (spec.postable) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Posted with the video when you publish to {spec.label}.
        </p>
        <CopyCaptionButton caption={caption} label="Copy" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Chip tone="yellow" pill>
          Copy only
        </Chip>
        <p className="text-muted-foreground mt-1.5 max-w-[52ch] text-xs">
          {spec.label} takes no caption over its API. Yapper sends the video to
          your drafts; paste this in the {spec.label} app before you publish.
        </p>
      </div>
      <CopyCaptionButton
        caption={caption}
        variant="outline"
        label={`Copy for ${spec.label}`}
      />
    </div>
  );
}
