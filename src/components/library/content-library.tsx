"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Film, Loader2, Plus, Share2 } from "lucide-react";
import StatusSelect from "@/components/library/status-select";
import PillarSelect from "@/components/library/pillar-select";
import IdeaCapture from "@/components/library/idea-capture";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import {
  createContent,
  defaultScheduleDate,
  patchContent,
  type ContentDetail,
  type ContentSummary,
} from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
}

/** The Content Library: the user's pipeline of ideas/scripts as a status
 * table. Rows open the script workbench. */
export default function ContentLibrary() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, refresh, patchRow, prependRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);
  const [creating, setCreating] = useState(false);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [pillarFilter, setPillarFilter] = useState<string | null>(null);

  // Distinct pillars present across the pipeline (sorted), for the filter.
  const pillarOptions = useMemo(() => {
    const set = new Set<string>();
    (items ?? []).forEach((r) => r.pillar && set.add(r.pillar));
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visibleItems = useMemo(() => {
    if (!items) return items;
    return pillarFilter
      ? items.filter((r) => r.pillar === pillarFilter)
      : items;
  }, [items, pillarFilter]);

  const newIdea = async () => {
    setCreating(true);
    try {
      const item = await createContent({ title: "" });
      router.push(`/studio/library/${item.id}`);
    } catch {
      setCreating(false);
    }
  };

  // A captured idea drops straight into the list (with a brief highlight) — no
  // navigation, so the user can keep dumping ideas.
  const onCaptured = (item: ContentDetail) => {
    prependRow(item);
    setFreshId(item.id);
    window.setTimeout(
      () => setFreshId((id) => (id === item.id ? null : id)),
      2200,
    );
  };

  const changeStatus = (row: ContentSummary, status: ContentStatus) => {
    const scheduledFor =
      status === "scheduled"
        ? (row.scheduledFor ?? defaultScheduleDate())
        : row.scheduledFor;
    patchRow(row.id, { status, scheduledFor });
    patchContent(row.id, { status, scheduledFor }).catch(() => {
      patchRow(row.id, {
        status: row.status,
        scheduledFor: row.scheduledFor,
      });
    });
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
            Content Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your pipeline from idea to posted.
            {importing && " Importing your saved ideas…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/studio/connections">
              <Share2 className="h-4 w-4" />
              Connections
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void newIdea()}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Blank idea
          </Button>
        </div>
      </div>

      {/* Talk-or-type capture: the primary way ideas enter the library. */}
      <div className="mb-6">
        <IdeaCapture onCaptured={onCaptured} />
      </div>

      {items === null ? (
        <div className="text-muted-foreground flex items-center gap-2 py-12 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground px-6 py-14 text-center">
          <p className="text-foreground text-base font-bold">
            Nothing in the pipeline yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm">
            Drop your first idea above — talk it out or type it. Or save clips
            in Inspiration and turn them into ideas from there.
          </p>
        </div>
      ) : (
        <>
          {pillarOptions.length > 0 && (
            <div className="mb-3 flex items-center gap-2">
              <PillarSelect
                value={pillarFilter}
                onChange={setPillarFilter}
                options={pillarOptions}
                emptyLabel="All pillars"
                ariaLabel="Filter by pillar"
              />
              {pillarFilter && (
                <span className="text-muted-foreground text-xs">
                  {visibleItems?.length ?? 0} in {pillarFilter}
                </span>
              )}
            </div>
          )}
          <Card className="gap-0 overflow-hidden py-0">
            {/* Header row */}
            <div className="sg-field-label bg-muted/40 hidden grid-cols-[1fr_130px_150px_40px] gap-3 border-b px-4 py-3 sm:grid">
              <span>Title</span>
              <span>Status</span>
              <span>Updated</span>
              <span />
            </div>
            {(visibleItems ?? []).length === 0 && (
              <div className="text-muted-foreground px-4 py-8 text-center text-sm">
                No ideas in this pillar yet.
              </div>
            )}
            {(visibleItems ?? []).map((row) => (
              // Not a <button>: the status control inside is itself a button, and
              // button-in-button is invalid HTML (hydration error, DOM reparenting).
              // A div with button semantics keeps the row clickable + keyboardable.
              <div
                key={row.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/studio/library/${row.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/studio/library/${row.id}`);
                  }
                }}
                className={`grid w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-b-0 sm:grid-cols-[1fr_130px_150px_40px] ${
                  freshId === row.id
                    ? "bg-[color:var(--sg-accent)]/10"
                    : "hover:bg-muted/40"
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
                  <StatusSelect
                    value={row.status}
                    onChange={(status) => changeStatus(row, status)}
                  />
                </span>
                <span className="text-muted-foreground hidden text-sm sm:block">
                  {when(row.updatedAt)}
                </span>
                <span className="hidden justify-self-end sm:block">
                  {row.submissionId && (
                    <Link
                      href={`/studio/editor?item=${row.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground block p-1"
                      title="Edit this recording"
                      aria-label="Edit this recording"
                    >
                      <Film className="h-4 w-4" />
                    </Link>
                  )}
                </span>
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
