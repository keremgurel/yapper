"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Lightbulb, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemFilters from "@/components/items/item-filters";
import ItemTable from "@/components/items/item-table";
import ItemTableSkeleton from "@/components/items/item-table-skeleton";
import { EmptyState, PageHeader } from "@/components/studio-ui";
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
  createContent,
  defaultScheduleDate,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import { createOptimisticUpdater } from "@/lib/content/reschedule";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * The Content Library: the ideas you have decided to make.
 *
 * A page title, a New button, and the saved views: a table with the columns
 * you chose, or a board grouped by status or pillar, the way a Notion
 * database works. Opening a row goes to the canvas where the words get
 * written; status changes happen here because that is the one thing you do
 * to many items in a sitting.
 */
export default function ContentLibrary() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, loadFailed, refresh, patchRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);

  const views = useLibraryViews("library", !!isSignedIn);
  // The saved view narrows first, then the ad-hoc search narrows further. A
  // view is the shape of the surface; the search is what you are looking for
  // inside it right now.
  const inView = applyViewFilters(items ?? [], views.active?.filters ?? {});
  const filters = useItemFilters(inView);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const columns = resolveColumns("library", views.active?.columns);
  const selection = useItemSelection(refresh);
  const [postItem, setPostItem] = useState<CrossPostTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const createLock = useRef(false);

  const [statusErrors, setStatusErrors] = useState<
    Record<string, () => Promise<void>>
  >({});
  const [saveStatus] = useState(() =>
    createOptimisticUpdater<Pick<ContentSummary, "status" | "scheduledFor">>({
      save: async (id, fields) => {
        const saved = await patchContent(id, fields);
        return { status: saved.status, scheduledFor: saved.scheduledFor };
      },
      show: patchRow,
      failed: (id, retry) =>
        setStatusErrors((current) => ({ ...current, [id]: retry })),
      saved: (id) =>
        setStatusErrors((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        }),
    }),
  );
  const changeStatus = (row: ContentSummary, status: ContentStatus) => {
    const scheduledFor =
      status === "scheduled"
        ? (row.scheduledFor ?? defaultScheduleDate())
        : row.scheduledFor;
    void saveStatus(
      row.id,
      { status, scheduledFor },
      { status: row.status, scheduledFor: row.scheduledFor },
    ).catch(() => {});
  };

  /** A blank item, opened straight away: the canvas is where it gets written. */
  const startNew = async () => {
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    setCreateFailed(false);
    try {
      const created = await createContent({ stage: "library" });
      router.push(`/studio/library/${created.id}`);
    } catch {
      setCreateFailed(true);
    } finally {
      createLock.current = false;
      setCreating(false);
    }
  };

  return (
    <div className="w-full pb-24">
      <PageHeader
        title="Content Library"
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => void startNew()}
            disabled={creating || !isSignedIn}
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            New
          </Button>
        }
      />

      {createFailed && (
        <p role="alert" className="text-destructive mb-3 text-sm">
          A new item couldn’t be created. Try again.
        </p>
      )}
      {importing && (
        <p className="text-muted-foreground mb-3 text-xs">
          Importing your saved ideas…
        </p>
      )}

      <ViewBar views={views} />

      {Object.entries(statusErrors).map(([id, retry]) => (
        <div
          key={id}
          role="alert"
          className="text-destructive mb-3 flex items-center gap-3 text-sm"
        >
          <p>
            The status change for{" "}
            {items?.find((row) => row.id === id)?.title || "this item"} couldn’t
            be saved.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void retry().catch(() => {})}
          >
            Retry
          </Button>
        </div>
      ))}
      {loadFailed ? (
        <EmptyState
          icon={Lightbulb}
          title="Your Library couldn’t be loaded"
          description="Try again to load your saved content."
          action={
            <Button variant="outline" onClick={() => void refresh()}>
              Try again
            </Button>
          }
        />
      ) : items === null ? (
        <ItemTableSkeleton columns={LIBRARY_COLUMNS} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Nothing here yet"
          description="Start a new one, or send ideas over from the Idea bank."
          action={
            <Button asChild variant="outline">
              <Link href="/studio/ideas">Open Idea bank</Link>
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
              groupBy={views.active?.groupBy}
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
