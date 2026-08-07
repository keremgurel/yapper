"use client";

import Link from "next/link";
import { FileText, Film, Link2, Minus, Send } from "lucide-react";
import StatusSelect from "@/components/library/status-select";
import { hasScript, type ColumnKey } from "@/lib/content/columns";
import type { ContentSummary } from "@/lib/content/client";
import type {
  ContentStatus,
  IdeaTypeValue,
  TranscriptStatus,
} from "@/lib/db/schema";

const TYPE_LABEL: Record<IdeaTypeValue, string> = {
  original: "Original",
  "semi-original": "Semi-original",
  inspiration: "Inspiration",
};

/** Reference state in one word. `ready` deliberately has no chip: the normal
 * case should be quiet, and only the problem cases should catch the eye. */
const TRANSCRIPT: Record<
  TranscriptStatus,
  { label: string; tone: string } | null
> = {
  ready: { label: "Transcript", tone: "text-muted-foreground" },
  pending: { label: "Fetching", tone: "text-muted-foreground" },
  needs_media: { label: "No transcript", tone: "text-amber-500" },
  unavailable: { label: "Summary only", tone: "text-amber-500" },
};

function Empty() {
  return <Minus aria-hidden className="text-muted-foreground/40 h-3.5 w-3.5" />;
}

/** One cell of the shared item table. Render-only: every mutation is raised to
 * the parent, so the table itself owns no data. */
export default function ItemCell({
  column,
  row,
  onStatus,
  onPost,
}: {
  column: ColumnKey;
  row: ContentSummary;
  onStatus: (status: ContentStatus) => void;
  onPost: () => void;
}) {
  switch (column) {
    case "title":
      return (
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-foreground min-w-0 truncate text-[15px] font-semibold">
            {row.title.trim() || firstLine(row.originalNote) || "Untitled idea"}
          </span>
          {row.sourceUrl && (
            <Link2
              aria-label="Has a reference"
              className="text-muted-foreground/70 h-3.5 w-3.5 shrink-0"
            />
          )}
        </span>
      );

    case "pillar":
      return row.pillar ? (
        <span className="truncate rounded-full bg-[color:var(--sg-accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[color:var(--sg-accent)]">
          {row.pillar}
        </span>
      ) : (
        <Empty />
      );

    case "type":
      return row.ideaType ? (
        <span className="text-muted-foreground truncate text-xs font-semibold">
          {TYPE_LABEL[row.ideaType]}
        </span>
      ) : (
        <Empty />
      );

    case "transcript": {
      const state = row.transcriptStatus
        ? TRANSCRIPT[row.transcriptStatus]
        : null;
      return state ? (
        <span className={`truncate text-xs font-semibold ${state.tone}`}>
          {state.label}
        </span>
      ) : (
        <Empty />
      );
    }

    case "status":
      return <StatusSelect value={row.status} onChange={onStatus} />;

    case "script":
      return hasScript(row) ? (
        <FileText
          aria-label="Has a script"
          className="h-4 w-4 text-[color:var(--sg-accent)]"
        />
      ) : (
        <Empty />
      );

    case "updated":
      return (
        <span className="text-muted-foreground truncate text-sm">
          {when(row.updatedAt)}
        </span>
      );

    case "actions":
      // Only a row with a recording can be edited or posted; the rest of the
      // pipeline has nothing to act on yet.
      if (!row.submissionId) return null;
      return (
        <span className="flex items-center gap-1 justify-self-end">
          <Link
            href={`/studio/editor?item=${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground block p-1"
            title="Edit this recording"
            aria-label="Edit this recording"
          >
            <Film className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPost();
            }}
            className="p-1 text-[color:var(--sg-accent)] hover:opacity-80"
            title="Post to a platform"
            aria-label="Post to a platform"
          >
            <Send className="h-4 w-4" />
          </button>
        </span>
      );
  }
}

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} · ${d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function firstLine(s: string): string {
  const line = s.split(/[.\n]/)[0]?.trim() ?? "";
  return line.length > 80 ? `${line.slice(0, 80)}…` : line;
}
