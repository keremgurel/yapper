"use client";

import { Video } from "lucide-react";
import type { CrossPostTarget } from "@/components/publish/compose/types";

/** The videos in a batch, named so the creator can see the whole thing they
 * are about to publish. */
export default function SourceList({
  sources,
}: {
  sources: CrossPostTarget[];
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-semibold">Videos</p>
      <div className="flex flex-col gap-1.5">
        {sources.map((source) => (
          <div
            key={source.id}
            className="text-foreground flex items-center gap-2 text-[13px]"
          >
            <Video aria-hidden className="text-muted-foreground h-3.5 w-3.5" />
            <span className="truncate">{source.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
