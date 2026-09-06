"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import TranscriptRecovery from "@/components/workbench/transcript-recovery";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";

/**
 * Where the piece came from: the creator's own words as captured, and the
 * reference it was captured from. Read-only and folded away by default; it is
 * evidence for the writing, not the writing, and Chirpy already sees it.
 */
export default function CanvasReference({
  item,
  update,
}: {
  item: ContentDetail;
  update: (patch: ContentPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const note = item.originalNote.trim();
  const sourceBody =
    item.sourceTranscript?.trim() || item.sourceSummary?.trim() || "";
  const hasSource = Boolean(item.sourceTitle || item.sourceUrl || sourceBody);
  const needsMedia = item.transcriptStatus === "needs_media";
  if (!note && !hasSource && !needsMedia) return null;

  const Chevron = open ? ChevronDown : ChevronRight;
  const summary = [
    note ? "your original note" : "",
    hasSource ? "the reference" : "",
  ]
    .filter(Boolean)
    .join(" and ");

  return (
    <section className="border-border/70 mt-12 border-t pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase"
        >
          <Chevron className="h-3.5 w-3.5" />
          Source
          <span className="font-normal tracking-normal normal-case">
            · {summary}
          </span>
        </button>
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
          >
            {item.sourceTitle
              ? truncate(item.sourceTitle, 48)
              : "Open reference"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {open && (
        <div className="mt-4 space-y-5">
          {note && (
            <blockquote className="text-foreground/75 max-w-[68ch] border-l border-[color:var(--sg-accent)]/40 pl-4 text-[15px] leading-relaxed whitespace-pre-wrap italic">
              {note}
            </blockquote>
          )}
          {needsMedia && (
            <TranscriptRecovery sourceUrl={item.sourceUrl} update={update} />
          )}
          {sourceBody && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs">
                {item.sourceTranscript?.trim()
                  ? "What the reference says"
                  : "A summary of the reference page, not its spoken words"}
              </p>
              <p className="text-foreground/70 max-h-72 max-w-[68ch] overflow-y-auto text-[15px] leading-relaxed whitespace-pre-wrap">
                {sourceBody}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
