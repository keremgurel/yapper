"use client";

import { useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import IdeaDetail from "@/components/ideas/idea-detail";
import { useItemDetail } from "@/hooks/use-item-detail";
import type { ItemSummary } from "@/lib/ideas/client";
import type { IdeaTypeValue, TranscriptStatus } from "@/lib/db/schema";

const TYPE_LABEL: Record<IdeaTypeValue, string> = {
  original: "Original",
  "semi-original": "Semi-original",
  inspiration: "Inspiration",
};

/** Reference state, reported plainly. A reel we could not hear says so, instead
 * of quietly presenting a page summary as though it were the source's words. */
const TRANSCRIPT_LABEL: Record<TranscriptStatus, string | null> = {
  ready: null,
  pending: "Fetching transcript",
  needs_media: "No transcript",
  unavailable: "Summary only",
};

/**
 * One idea in the bank: identity and state up front, the full body behind a
 * disclosure that fetches it on first open.
 */
export default function IdeaCard({
  item,
  selected,
  working,
  analysisFailed,
  onToggle,
  onRetry,
}: {
  item: ItemSummary;
  selected: boolean;
  working: boolean;
  analysisFailed: boolean;
  onToggle: () => void;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { detail, loading } = useItemDetail(item.id, open);

  const title =
    item.title ||
    firstLine(item.originalNote) ||
    item.sourceTitle ||
    item.sourceUrl ||
    "New idea";
  const transcriptNote = item.transcriptStatus
    ? TRANSCRIPT_LABEL[item.transcriptStatus]
    : null;

  return (
    <div
      className={`border-border bg-card rounded-xl border transition-colors ${
        selected ? "border-[color:var(--sg-accent)]/60" : ""
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? "Deselect" : "Select"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
            selected
              ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
              : "border-border hover:border-foreground/40"
          }`}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            {item.ideaType && (
              <span className="rounded-full bg-[color:var(--sg-accent)]/12 px-2 py-0.5 text-[11px] font-bold text-[color:var(--sg-accent)]">
                {TYPE_LABEL[item.ideaType]}
              </span>
            )}
            {working && (
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Loader2 className="h-3 w-3 animate-spin" />
                Working
              </span>
            )}
            {analysisFailed && !working && (
              <span className="text-destructive flex items-center gap-1 text-xs">
                <AlertCircle className="h-3 w-3" />
                Analysis failed
              </span>
            )}
            {!working && transcriptNote && (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">
                {transcriptNote}
              </span>
            )}
          </div>
          <p className="text-foreground truncate text-[15px] font-bold">
            {title}
          </p>
          {item.pillar && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {item.pillar}
            </p>
          )}
        </button>

        {analysisFailed && !working && (
          <button
            type="button"
            onClick={onRetry}
            title="Retry analysis"
            aria-label="Retry analysis"
            className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 p-1"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the reference"
            aria-label="Open the reference"
            className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 p-1"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <ChevronDown
          aria-hidden="true"
          className={`text-muted-foreground mt-1 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="border-border border-t px-4 py-5 text-sm">
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          ) : detail ? (
            <IdeaDetail detail={detail} />
          ) : (
            <p className="text-muted-foreground">
              Couldn&apos;t load this idea. Close and reopen to retry.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function firstLine(s: string): string {
  const line = s.split(/[.\n]/)[0]?.trim() ?? "";
  return line.length > 80 ? line.slice(0, 80) : line;
}
