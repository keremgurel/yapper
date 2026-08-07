"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { ArrowRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemFilters from "@/components/items/item-filters";
import ItemTable from "@/components/items/item-table";
import ItemTableSkeleton from "@/components/items/item-table-skeleton";
import { Button } from "@/components/ui/button";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import { useContentSort } from "@/hooks/use-content-sort";
import { useItemFilters } from "@/hooks/use-item-filters";
import { useItemSelection } from "@/hooks/use-item-selection";
import BoardView from "@/components/views/board-view";
import ViewSettings from "@/components/views/view-settings";
import ViewTabs from "@/components/views/view-tabs";
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
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-foreground text-2xl font-black tracking-tight">
            Content Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The ideas you sent from the Idea Bank, from draft to posted.
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

      {views.views.length > 0 && (
        <div className="mb-4">
          <ViewTabs
            views={views.views}
            activeId={views.active?.id ?? null}
            onSelect={views.setActiveId}
            onAdd={() =>
              void views.create({
                name: "New view",
                kind: "table",
                groupBy: null,
                filters: {},
                columns: [],
              })
            }
          />
          {views.active && (
            <ViewSettings
              view={views.active}
              onSave={(draft) => void views.save(views.active!.id, draft)}
              onDelete={() => void views.remove(views.active!.id)}
            />
          )}
        </div>
      )}

      {items === null ? (
        <ItemTableSkeleton columns={LIBRARY_COLUMNS} />
      ) : items.length === 0 ? (
        <div className="text-muted-foreground px-6 py-14 text-center">
          <p className="text-foreground text-base font-bold">
            Nothing in the pipeline yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-sm">
            Capture ideas in the Idea Bank, then send the ones you want to
            develop here.
          </p>
          <Button asChild className="mt-4">
            <Link href="/studio/ideas">Go to Idea Bank</Link>
          </Button>
        </div>
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
