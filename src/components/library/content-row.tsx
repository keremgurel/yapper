"use client";

import Link from "next/link";
import { Film, Send } from "lucide-react";
import StatusSelect from "@/components/library/status-select";
import { ROW_GRID } from "@/components/library/content-table-layout";
import type { ContentSummary } from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** One library row: title + pillar chip, inline status control, last-edited
 * time, and (for rows with a recording) edit/post shortcuts. Not a `<button>`,
 * because the status control inside is itself a button and button-in-button is
 * invalid HTML; a div with button semantics keeps the row clickable and
 * keyboardable. Render-only: the parent persists changes and navigates. */
export default function ContentRow({
  row,
  fresh,
  onOpen,
  onStatus,
  onPost,
}: {
  row: ContentSummary;
  fresh: boolean;
  onOpen: () => void;
  onStatus: (status: ContentStatus) => void;
  onPost: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`${ROW_GRID} w-full cursor-pointer border-b px-4 py-3.5 text-left transition-colors last:border-b-0 ${
        fresh ? "bg-[color:var(--sg-accent)]/10" : "hover:bg-muted/40"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="text-foreground min-w-0 truncate text-[15px] font-bold">
          {row.title.trim() || "Untitled idea"}
        </span>
        {row.pillar && (
          <span className="hidden shrink-0 rounded-full bg-[color:var(--sg-accent)]/15 px-2 py-0.5 text-[11px] font-black whitespace-nowrap text-[color:var(--sg-accent)] sm:inline">
            {row.pillar}
          </span>
        )}
      </span>
      <span>
        <StatusSelect value={row.status} onChange={onStatus} />
      </span>
      <span className="text-muted-foreground hidden text-sm sm:block">
        {when(row.updatedAt)}
      </span>
      <span className="hidden items-center gap-1 justify-self-end sm:flex">
        {row.submissionId && (
          <>
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
          </>
        )}
      </span>
    </div>
  );
}
