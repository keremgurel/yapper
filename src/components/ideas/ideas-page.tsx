"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Archive, Lightbulb, Loader2, Plus } from "lucide-react";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import IdeaCapture from "@/components/ideas/idea-capture";
import InstagramImportSheet from "@/components/ideas/instagram-import-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemFilters from "@/components/items/item-filters";
import ItemTable from "@/components/items/item-table";
import ItemTableSkeleton from "@/components/items/item-table-skeleton";
import BoardView from "@/components/views/board-view";
import ViewBar from "@/components/views/view-bar";
import { EmptyState, PageHeader } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { useContentSort } from "@/hooks/use-content-sort";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import { useItemFilters } from "@/hooks/use-item-filters";
import { useItemSelection } from "@/hooks/use-item-selection";
import { useLibraryViews } from "@/hooks/use-library-views";
import {
  createContent,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import { LIBRARY_COLUMNS, resolveColumns } from "@/lib/content/columns";
import { applyViewFilters } from "@/lib/content/group-items";
import { createOptimisticUpdater } from "@/lib/content/reschedule";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * Ideas: the one list.
 *
 * Capture on top. Below it every idea, whatever its status, in the saved
 * views: a table with the columns you chose, or a board grouped by status or
 * pillar, which is the pipeline. Opening a row goes to its canvas. Capturing
 * runs the automatic first pass (transcribe the link, classify, write the
 * direction, hooks and a first draft) and the row updates as it lands.
 */
export default function IdeasPage() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const {
    bank: items,
    loading,
    loadFailed,
    refreshFailed,
    sourceUrls,
    capture,
    importInstagramSaves,
    refresh,
    patchRow,
  } = useIdeaBank();
  const [importOpen, setImportOpen] = useState(false);
  const [postItem, setPostItem] = useState<CrossPostTarget | null>(null);
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);
  const createLock = useRef(false);

  // Saved views were scoped per surface when there were two. Everything now
  // lives under the library scope so the views a creator already made survive.
  const views = useLibraryViews("library", !!isSignedIn);
  const inView = applyViewFilters(items, views.active?.filters ?? {});
  const filters = useItemFilters(inView);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const columns = resolveColumns("library", views.active?.columns);
  const selection = useItemSelection(refresh);

  const [statusErrors, setStatusErrors] = useState<
    Record<string, () => Promise<void>>
  >({});
  const [saveStatus] = useState(() =>
    createOptimisticUpdater<Pick<ContentSummary, "status" | "scheduledFor">>({
      save: async (id, fields) => {
        const saved = await patchContent(id, fields);
        return { status: saved.status, scheduledFor: saved.scheduledFor };
      },
      show: (id, fields) => patchRow(id, fields),
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
    void saveStatus(
      row.id,
      { status, scheduledFor: row.scheduledFor },
      { status: row.status, scheduledFor: row.scheduledFor },
    ).catch(() => {});
  };

  /** A blank canvas, opened straight away, for writing without a capture. */
  const startBlank = async () => {
    if (createLock.current) return;
    createLock.current = true;
    setCreating(true);
    setCreateFailed(false);
    try {
      const created = await createContent({ status: "drafting" });
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
        title="Ideas"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <Archive className="h-3.5 w-3.5" />
              Import from Instagram
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void startBlank()}
              disabled={creating || !isSignedIn}
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              Blank
            </Button>
          </>
        }
      />

      <IdeaCapture onCapture={capture} />

      <div className="mt-8">
        {createFailed && (
          <p role="alert" className="text-destructive mb-3 text-sm">
            A blank idea couldn’t be created. Try again.
          </p>
        )}
        {refreshFailed && (
          <p role="alert" className="text-destructive mb-3 text-sm">
            Your latest changes couldn’t be loaded.{" "}
            <button className="underline" onClick={() => void refresh()}>
              Try again
            </button>
          </p>
        )}
        {Object.entries(statusErrors).map(([id, retry]) => (
          <div
            key={id}
            role="alert"
            className="text-destructive mb-3 flex items-center gap-3 text-sm"
          >
            <p>
              The status change for{" "}
              {items.find((row) => row.id === id)?.title || "this idea"}{" "}
              couldn’t be saved.
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
            title="Your ideas couldn’t be loaded"
            description="They are still in your account. Try loading them again."
            action={
              <Button variant="outline" onClick={() => void refresh()}>
                Try again
              </Button>
            }
          />
        ) : loading ? (
          <ItemTableSkeleton columns={LIBRARY_COLUMNS} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Nothing here yet"
            description="Write or dictate a thought above, or paste a link. It lands here with a first draft."
          />
        ) : (
          <>
            <ViewBar views={views} />
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
      </div>

      <BulkBar
        count={selection.count}
        onSetPillar={selection.actions.setPillar}
        onSetStatus={selection.actions.setStatus}
        onDelete={selection.actions.remove}
        onClear={selection.clear}
      />

      <InstagramImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        existingUrls={sourceUrls}
        onImport={importInstagramSaves}
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
