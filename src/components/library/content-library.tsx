"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Lightbulb } from "lucide-react";
import Link from "next/link";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemFilters from "@/components/items/item-filters";
import ItemTable from "@/components/items/item-table";
import ItemTableSkeleton from "@/components/items/item-table-skeleton";
import LabOverview, { LabSwitchLink } from "@/components/items/lab-overview";
import { EmptyState } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import { useContentSort } from "@/hooks/use-content-sort";
import { useItemFilters } from "@/hooks/use-item-filters";
import { useItemSelection } from "@/hooks/use-item-selection";
import BoardView from "@/components/views/board-view";
import ViewBar from "@/components/views/view-bar";
import { useLibraryViews } from "@/hooks/use-library-views";
import { LIBRARY_COLUMNS, resolveColumns } from "@/lib/content/columns";
import { applyViewFilters } from "@/lib/content/group-items";
import {
  defaultScheduleDate,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * The Content Library: the pipeline of ideas you have committed to making.
 *
 * Renders the same table as the Idea Bank, filtered to `stage = 'library'` and
 * showing the pipeline columns instead of the capture ones.
 */
export default function ContentLibrary() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, refresh, patchRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);

  const views = useLibraryViews("library", !!isSignedIn);
  // The saved view narrows first, then the ad-hoc search and pillar picker
  // narrow further. A view is the shape of the surface; the filter bar is what
  // you are looking for inside it right now.
  const inView = applyViewFilters(items ?? [], views.active?.filters ?? {});
  const filters = useItemFilters(inView);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const columns = resolveColumns("library", views.active?.columns);
  const selection = useItemSelection(refresh);
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
    <div className="w-full pb-24">
      <LabOverview
        mode="library"
        items={items}
        action={<LabSwitchLink mode="library" />}
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-[color:var(--sg-accent-strong)] uppercase">
            Your working slate
          </p>
          <h2 className="font-display text-foreground mt-1 text-2xl font-semibold tracking-[-0.04em]">
            Content pipeline
          </h2>
          {importing && (
            <p className="text-muted-foreground mt-1 text-xs">
              Importing your saved ideas…
            </p>
          )}
        </div>
        <p className="text-muted-foreground max-w-md text-xs leading-5 sm:text-right">
          Open any row to develop its hook and script. Change status here as the
          work moves forward.
        </p>
      </div>

      <ViewBar views={views} />

      {items === null ? (
        <ItemTableSkeleton columns={LIBRARY_COLUMNS} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nothing in the pipeline yet"
          description="Capture ideas in the Idea Bank, then send the ones you want to develop here."
          action={
            <Button asChild>
              <Link href="/studio/ideas">Go to Idea Bank</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ItemFilters
            query={filters.query}
            onQuery={filters.setQuery}
            pillar={filters.pillar}
            onPillar={filters.setPillar}
            pillarOptions={filters.pillarOptions}
            resultLabel={filters.resultLabel}
          />
          {views.active?.kind === "board" ? (
            <BoardView
              rows={filters.filtered}
              groupBy={views.active.groupBy}
              onOpen={(id) => router.push(`/studio/library/${id}`)}
              onStatusChange={changeStatus}
            />
          ) : (
            <ItemTable
              rows={sorted ?? []}
              columns={columns}
              sort={sort}
              onToggleSort={toggleSort}
              selectedIds={selection.ids}
              onToggleSelect={selection.toggle}
              onSelectAll={selection.selectAll}
              onOpen={(id) => router.push(`/studio/library/${id}`)}
              onStatus={changeStatus}
              onPost={(row) =>
                setPostItem({
                  id: row.id,
                  title: row.title.trim() || "Untitled",
                  submissionId: row.submissionId!,
                })
              }
              emptyLabel="Nothing matches those filters."
            />
          )}
        </>
      )}

      <BulkBar
        stage="library"
        count={selection.count}
        onSetPillar={selection.actions.setPillar}
        onMove={selection.actions.move}
        onSetStatus={selection.actions.setStatus}
        onDelete={selection.actions.remove}
        onClear={selection.clear}
      />

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
