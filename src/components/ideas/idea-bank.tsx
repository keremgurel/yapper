"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Archive, Lightbulb } from "lucide-react";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import { useItemFilters } from "@/hooks/use-item-filters";
import { useItemSelection } from "@/hooks/use-item-selection";
import { useContentSort } from "@/hooks/use-content-sort";
import { useLibraryViews } from "@/hooks/use-library-views";
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
import { BANK_COLUMNS, resolveColumns } from "@/lib/content/columns";
import { applyViewFilters } from "@/lib/content/group-items";

/**
 * The Idea bank: a place to put a thought down, and the ideas already there.
 *
 * Capture at the top. Below it, the same saved views the Library has: a table
 * with the columns you chose, or a board grouped by pillar or status. Opening
 * an idea goes to its canvas; selecting rows brings up the bulk bar, which is
 * how ideas move to the Library.
 */
export default function IdeaBank() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const {
    bank,
    loading,
    loadFailed,
    refreshFailed,
    sourceUrls,
    capture,
    importInstagramSaves,
    refresh,
  } = useIdeaBank();
  const [importOpen, setImportOpen] = useState(false);

  const views = useLibraryViews("bank", !!isSignedIn);
  const inView = applyViewFilters(bank, views.active?.filters ?? {});
  const filters = useItemFilters(inView);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const columns = resolveColumns("bank", views.active?.columns);
  const selection = useItemSelection(refresh);

  return (
    <div className="w-full pb-24">
      <PageHeader
        title="Idea bank"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
          >
            <Archive className="h-3.5 w-3.5" />
            Import from Instagram
          </Button>
        }
      />

      <IdeaCapture onCapture={capture} />

      <div className="mt-8">
        {refreshFailed && (
          <p role="alert" className="text-destructive mb-3 text-sm">
            Your latest changes couldn’t be loaded.{" "}
            <button className="underline" onClick={() => void refresh()}>
              Try again
            </button>
          </p>
        )}
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
          <ItemTableSkeleton columns={BANK_COLUMNS} />
        ) : bank.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Nothing here yet"
            description="Write or dictate a thought above. It lands here."
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
                onStatusChange={() => undefined}
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
                onStatus={() => undefined}
                onPost={() => undefined}
                emptyLabel="Nothing matches those filters."
              />
            )}
          </>
        )}
      </div>

      <BulkBar
        stage="bank"
        count={selection.count}
        onSetPillar={selection.actions.setPillar}
        onMove={selection.actions.move}
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
    </div>
  );
}
