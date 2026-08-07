"use client";

import { useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronRight } from "lucide-react";
import TranscriptRecovery from "@/components/workbench/transcript-recovery";
import type { ContentPatch } from "@/lib/content/client";
import type { TranscriptStatus } from "@/lib/db/schema";

/** What the app managed to hear, stated plainly. A reference we could not
 * transcribe says so instead of quietly presenting itself as an article. */
const STATUS: Record<TranscriptStatus, { label: string; tone: string }> = {
  ready: { label: "Transcript ready", tone: "text-muted-foreground" },
  pending: { label: "Transcribing…", tone: "text-muted-foreground" },
  needs_media: { label: "No transcript", tone: "text-amber-500" },
  unavailable: { label: "Summary only", tone: "text-amber-500" },
};

/**
 * The reference this idea came from: where it is, what we heard, and the
 * verbatim transcript behind a disclosure.
 *
 * The transcript is collapsed by default because it is evidence rather than
 * working material, and an open one pushes the creator's own words off screen.
 */
export default function SourceCard({
  title,
  url,
  transcript,
  summary,
  status,
  update,
}: {
  title: string | null;
  url: string | null;
  transcript: string | null;
  summary: string | null;
  status: TranscriptStatus | null;
  update: (patch: ContentPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const body = transcript?.trim() || summary?.trim() || "";
  // A reference with nothing at all still renders when it needs recovering:
  // that empty state is the point, not something to hide.
  const needsMedia = status === "needs_media";
  if (!title && !url && !body && !needsMedia) return null;

  const state = status ? STATUS[status] : null;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <section className="border-border rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold"
          >
            <span className="truncate">From: {title ?? url}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" />
          </a>
        ) : (
          <span className="text-muted-foreground truncate text-sm font-semibold">
            From: {title}
          </span>
        )}
        {state && (
          <span className={`text-xs font-semibold ${state.tone}`}>
            {state.label}
          </span>
        )}
      </div>

      {body && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs font-semibold"
          >
            <Chevron className="h-3.5 w-3.5" />
            {transcript?.trim() ? "Transcript" : "Source summary"}
          </button>
          {open && (
            <p className="text-foreground/75 mt-2 max-h-72 overflow-y-auto text-sm whitespace-pre-wrap">
              {body}
            </p>
          )}
        </>
      )}

      {needsMedia && <TranscriptRecovery sourceUrl={url} update={update} />}
    </section>
  );
}
