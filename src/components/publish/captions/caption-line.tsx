"use client";

import { visibleSplit } from "@/components/publish/captions/caption-draft";
import type { PlatformCaption } from "@/lib/publish/caption";

/**
 * A one-glance version of the caption: exactly the part the platform shows
 * before "more", and an ellipsis when there is more behind it. For review
 * lists, where the full text would bury the thing being reviewed.
 */
export default function CaptionLine({ caption }: { caption: PlatformCaption }) {
  const { shown, hidden } = visibleSplit(caption);

  if (!shown) {
    return (
      <p className="text-muted-foreground text-[13px] italic">
        Nothing written
      </p>
    );
  }

  return (
    <p className="text-foreground max-w-[68ch] text-[13px] leading-relaxed">
      {shown}
      {hidden && <span className="text-muted-foreground">…</span>}
    </p>
  );
}
