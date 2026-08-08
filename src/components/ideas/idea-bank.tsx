"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Lightbulb } from "lucide-react";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import { useItemFilters } from "@/hooks/use-item-filters";
import { useItemSelection } from "@/hooks/use-item-selection";
import { useContentSort } from "@/hooks/use-content-sort";
import IdeaCapture from "@/components/ideas/idea-capture";
import IdeaCardList from "@/components/ideas/idea-card-list";
import IdeaViewToggle, {
  type BankView,
} from "@/components/ideas/idea-view-toggle";
import InstagramImportSheet from "@/components/ideas/instagram-import-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemFilters from "@/components/items/item-filters";
import ItemTable from "@/components/items/item-table";
import ItemTableSkeleton from "@/components/items/item-table-skeleton";
import { EmptyState, PageHeader } from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { BANK_COLUMNS } from "@/lib/content/columns";

/**
 * The Idea bank: capture at the top, then the same table the Content Library
 * renders, filtered to `stage = 'bank'`.
 *
 * The card view is kept as an alternate mode rather than dropped: a bank entry
 * carries a reference, a verbatim note and an AI body, and sometimes you want
 * to read those rather than scan a row.
 */
export default function IdeaBank() {
  const router = useRouter();
  const {
    bank,
    loading,
    working,
    analysisErrors,
    sourceUrls,
    capture,
    importInstagramSaves,
    retry,
    refresh,
  } = useIdeaBank();

  const [view, setView] = useState<BankView>("table");
  const [importOpen, setImportOpen] = useState(false);
  const filters = useItemFilters(bank);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const selection = useItemSelection(refresh);

  const rows = sorted ?? [];

  return (
    <div className="w-full pb-24">
      <PageHeader
        title="Idea Bank"
        description="Capture it in seconds, keep the original reference, and send the keepers to your library."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            title="Step-by-step Instagram saved-post import"
          >
            <Archive className="h-3.5 w-3.5" />
            Import saves
          </Button>
        }
      />

      <IdeaCapture onCapture={capture} />

      <div className="mt-8">
        {loading ? (
          <ItemTableSkeleton columns={BANK_COLUMNS} />
        ) : bank.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="No ideas banked yet"
            description="Capture your first idea above: type it or press the mic, and Chirpy expands it against your project."
          />
        ) : (
          <>
            {/* ItemFilters carries the toolbar rhythm (mb-3) itself, so the
                view toggle rides beside it instead of inside a second Toolbar
                wrapper that would double the margin. */}
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <ItemFilters
                  query={filters.query}
                  onQuery={filters.setQuery}
                  pillar={filters.pillar}
                  onPillar={filters.setPillar}
                  pillarOptions={filters.pillarOptions}
                  resultLabel={filters.resultLabel}
                />
              </div>
              <IdeaViewToggle view={view} onChange={setView} />
            </div>

            {view === "table" ? (
              <ItemTable
                rows={rows}
                columns={BANK_COLUMNS}
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
            ) : (
              <IdeaCardList
                rows={rows}
                selectedIds={selection.ids}
                working={working}
                analysisErrors={analysisErrors}
                onToggleSelect={selection.toggle}
                onRetry={retry}
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
