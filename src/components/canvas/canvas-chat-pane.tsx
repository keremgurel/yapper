"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CanvasPromptBar from "@/components/canvas/canvas-prompt-bar";
import CanvasReference from "@/components/canvas/canvas-reference";
import CanvasThread from "@/components/canvas/canvas-thread";
import ReadLine from "@/components/brain/recall/read-line";
import { Button } from "@/components/ui/button";
import type { BrainUsed } from "@/lib/brain/context/types";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";
import type { CanvasMessage } from "@/hooks/use-canvas-thread";

/**
 * The talk beside the document: where the piece came from, what has been
 * said about it, and the one field for the next ask. The document never
 * scrolls with it.
 */
export default function CanvasChatPane({
  item,
  update,
  thread,
  prompt,
  used,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
  thread: Omit<Parameters<typeof CanvasThread>[0], never>;
  prompt: Parameters<typeof CanvasPromptBar>[0];
  used: BrainUsed | null;
}) {
  const hasInspiration = Boolean(
    item.sourceTitle ||
    item.sourceUrl ||
    item.sourceTranscript ||
    item.sourceSummary ||
    item.recordedTranscript ||
    item.originalNote.trim(),
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center px-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Link href="/studio/ideas">
            <ArrowLeft className="h-4 w-4" />
            Ideas
          </Link>
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-4">
        {hasInspiration && (
          <details className="group">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none text-[13px] font-medium select-none">
              Where this came from
            </summary>
            <div className="mt-3">
              <CanvasReference item={item} update={update} />
            </div>
          </details>
        )}
        <CanvasThread {...thread} />
      </div>
      <div className="shrink-0 px-3 pb-3">
        <CanvasPromptBar {...prompt} />
        {used && (
          <div className="mt-2">
            <ReadLine used={used} />
          </div>
        )}
      </div>
    </div>
  );
}

export type { CanvasMessage };
