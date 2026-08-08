"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Chip, pillarTone, type ChipTone } from "@/components/studio-ui";
import type { ItemSummary } from "@/lib/ideas/client";
import type { IdeaTypeValue, TranscriptStatus } from "@/lib/db/schema";

const TYPE_LABEL: Record<IdeaTypeValue, string> = {
  original: "Original",
  "semi-original": "Semi-original",
  inspiration: "Inspiration",
};

/**
 * Reference state, reported plainly. A reel we could not hear says so, instead
 * of quietly presenting a page summary as though it were the source's words.
 * Cyan while we are still fetching, yellow once the reference is degraded;
 * a healthy transcript needs no badge at all.
 */
const TRANSCRIPT_CHIP: Record<
  TranscriptStatus,
  { label: string; tone: ChipTone } | null
> = {
  ready: null,
  pending: { label: "Fetching transcript", tone: "cyan" },
  needs_media: { label: "No transcript", tone: "yellow" },
  unavailable: { label: "Summary only", tone: "yellow" },
};

/**
 * The metadata row under a card title. Pillar is the only colored chip (dot
 * variant, hue hashed from the name); idea type stays plain muted text because
 * it is categorical, not a signal.
 */
export default function IdeaCardMeta({
  item,
  working,
  analysisFailed,
}: {
  item: ItemSummary;
  working: boolean;
  analysisFailed: boolean;
}) {
  const transcript =
    !working && item.transcriptStatus
      ? TRANSCRIPT_CHIP[item.transcriptStatus]
      : null;

  const empty =
    !item.pillar &&
    !item.ideaType &&
    !transcript &&
    !working &&
    !analysisFailed;
  if (empty) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {item.pillar && (
        <Chip variant="dot" tone={pillarTone(item.pillar)}>
          {item.pillar}
        </Chip>
      )}
      {item.ideaType && (
        <span className="text-muted-foreground text-xs">
          {TYPE_LABEL[item.ideaType]}
        </span>
      )}
      {transcript && <Chip tone={transcript.tone}>{transcript.label}</Chip>}
      {working && (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
          Working
        </span>
      )}
      {analysisFailed && !working && (
        <span className="text-destructive flex items-center gap-1 text-xs">
          <AlertCircle aria-hidden className="h-3 w-3" />
          Analysis failed
        </span>
      )}
    </div>
  );
}
