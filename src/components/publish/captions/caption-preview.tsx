"use client";

import { visibleSplit } from "@/components/publish/captions/caption-draft";
import type { PlatformCaption } from "@/lib/publish/caption";
import { captionSpec } from "@/lib/publish/caption-specs";

/**
 * The caption as the platform shows it, cut where it collapses behind "more".
 *
 * A character counter answers "will this be rejected", which almost never
 * happens. This answers the question that decides whether anyone reads the
 * post: how much of it is on screen before the scroller has to tap.
 */
export default function CaptionPreview({
  caption,
}: {
  caption: PlatformCaption;
}) {
  const spec = captionSpec(caption.platform);
  const { shown, hidden } = visibleSplit(caption);

  if (!shown) {
    return (
      <p className="text-muted-foreground bg-muted rounded-lg px-3 py-2.5 text-[13px]">
        Nothing to show yet. The first {spec.visibleChars} characters are what a
        scroller sees.
      </p>
    );
  }

  return (
    <div className="bg-muted rounded-lg px-3 py-2.5">
      <p className="text-foreground max-w-[68ch] text-[13px] leading-relaxed whitespace-pre-wrap">
        {shown}
        {hidden && (
          <>
            <span className="bg-background text-muted-foreground mx-1 rounded px-1 align-middle text-[11px] font-bold tracking-[0.1em] uppercase">
              more
            </span>
            <span className="text-muted-foreground">{hidden}</span>
          </>
        )}
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        {hidden
          ? `Everything after the first ${spec.visibleChars} characters is collapsed.`
          : `Fits inside the ${spec.visibleChars} characters shown before "more".`}
      </p>
    </div>
  );
}
