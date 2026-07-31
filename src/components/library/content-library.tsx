"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import PillarSelect from "@/components/library/pillar-select";
import ContentTable from "@/components/library/content-table";
import ContentTableSkeleton from "@/components/library/content-table-skeleton";
import { Button } from "@/components/ui/button";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import { useContentSort } from "@/hooks/use-content-sort";
import {
  defaultScheduleDate,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

/** The Content Library: the user's pipeline of ideas/scripts as a sortable
 * status table. Orchestrates capture, the pillar filter, and the table; the
 * table, rows, sorting, and loading state each live in their own module. */
export default function ContentLibrary() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, refresh, patchRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);
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

  const { sort, toggle, sorted } = useContentSort(visibleItems);

  const [postItem, setPostItem] = useState<CrossPostTarget | null>(null);

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
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
            Content Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The ideas you send from Idea Bank, organized from draft to posted.
            {importing && " Importing your saved ideas…"}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/studio/ideas">
            <Lightbulb className="h-4 w-4" />
            Open Idea Bank
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {items === null ? (
        <ContentTableSkeleton />
      ) : items.length === 0 ? (
        <div className="text-muted-foreground px-6 py-14 text-center">
          <p className="text-foreground text-base font-bold">
            Nothing in the pipeline yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm">
            Capture ideas in Idea Bank, then send the ones you want to develop
            here.
          </p>
          <Button asChild className="mt-4">
            <Link href="/studio/ideas">Go to Idea Bank</Link>
          </Button>
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
          <ContentTable
            rows={sorted ?? []}
            sort={sort}
            onToggleSort={toggle}
            onOpen={(id) => router.push(`/studio/library/${id}`)}
            onStatus={changeStatus}
            onPost={(row) =>
              setPostItem({
                id: row.id,
                title: row.title.trim() || "Untitled",
                submissionId: row.submissionId!,
              })
            }
            freshId={null}
          />
        </>
      )}

      {postItem && (
        <CrossPostSheet
          key={postItem.id}
          item={postItem}
          onClose={() => setPostItem(null)}
        />
      )}
    </div>
  );
}
