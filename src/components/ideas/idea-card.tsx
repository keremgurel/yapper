"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import IdeaCardMeta from "@/components/ideas/idea-card-meta";
import IdeaDetail from "@/components/ideas/idea-detail";
import { useItemDetail } from "@/hooks/use-item-detail";
import type { ItemSummary } from "@/lib/ideas/client";

/**
 * One idea in the bank, built for reading: title, the captured words in
 * preview, then the full body behind a disclosure that fetches on first open.
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
  // Only preview the note once expansion has produced a real title; before
  // that the title IS the note's first line and the preview would repeat it.
  const preview = item.title && item.originalNote ? item.originalNote : null;

  return (
    <div
      className={`bg-card rounded-xl border transition-colors ${
        selected ? "border-[color:var(--sg-accent)]/60" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-label={selected ? "Deselect" : "Select"}
          aria-pressed={selected}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
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
          className="min-w-0 flex-1 text-left focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
        >
          <p className="text-foreground truncate text-[15px] font-semibold">
            {title}
          </p>
          {preview && (
            <p className="text-muted-foreground mt-1 line-clamp-2 max-w-[68ch] text-[13px] leading-relaxed">
              {preview}
            </p>
          )}
          <div className="mt-2">
            <IdeaCardMeta
              item={item}
              working={working}
              analysisFailed={analysisFailed}
            />
          </div>
        </button>

        {/* Also offered when the reference resolved but we could not hear it:
            the usual cause is a depleted scraper or a rate limit, so the same
            retry is the cheapest thing worth trying before attaching the file
            by hand in the workbench. */}
        {(analysisFailed || item.transcriptStatus === "needs_media") &&
          !working && (
            <button
              type="button"
              onClick={onRetry}
              title={
                analysisFailed
                  ? "Retry analysis"
                  : "Retry fetching the transcript"
              }
              aria-label={
                analysisFailed
                  ? "Retry analysis"
                  : "Retry fetching the transcript"
              }
              className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 rounded-md p-1 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
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
            className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 rounded-md p-1 focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none"
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
        <div className="border-border border-t px-4 py-5">
          {loading ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </p>
          ) : detail ? (
            <IdeaDetail detail={detail} />
          ) : (
            <p className="text-muted-foreground text-sm">
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
