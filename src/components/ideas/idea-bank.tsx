"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, LayoutGrid, Loader2, Rows3 } from "lucide-react";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import { useItemFilters } from "@/hooks/use-item-filters";
import { useItemSelection } from "@/hooks/use-item-selection";
import { useContentSort } from "@/hooks/use-content-sort";
import IdeaCapture from "@/components/ideas/idea-capture";
import IdeaCard from "@/components/ideas/idea-card";
import InstagramImportSheet from "@/components/ideas/instagram-import-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemFilters from "@/components/items/item-filters";
import ItemTable from "@/components/items/item-table";
import { Button } from "@/components/ui/button";
import { BANK_COLUMNS } from "@/lib/content/columns";

type View = "table" | "cards";

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

  const [view, setView] = useState<View>("table");
  const [importOpen, setImportOpen] = useState(false);
  const filters = useItemFilters(bank);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const selection = useItemSelection(refresh);

  const rows = sorted ?? [];

  return (
    <div className="w-full pb-24">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-foreground text-2xl font-black">
            Idea bank
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Capture it in seconds. Keep the original reference, understand why
            it works, and send the keepers to your library.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
          <div className="border-border flex items-center rounded-full border p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label="Table view"
              aria-pressed={view === "table"}
              className={`rounded-full p-1.5 transition-colors ${
                view === "table"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Rows3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-label="Card view"
              aria-pressed={view === "cards"}
              className={`rounded-full p-1.5 transition-colors ${
                view === "cards"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            title="Step-by-step Instagram saved-post import"
          >
            <Archive className="h-3.5 w-3.5 text-[color:var(--sg-accent)]" />
            Import saves
          </Button>
        </div>
      </header>

      <IdeaCapture onCapture={capture} />

      <div className="mt-5">
        {loading ? (
          <p className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading your ideas…
          </p>
        ) : bank.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Your ideas show up here. Drop your first one above.
          </p>
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
              <div className="space-y-2.5">
                {rows.map((row) => (
                  <IdeaCard
                    key={row.id}
                    item={row}
                    selected={selection.ids.has(row.id)}
                    working={working.has(row.id)}
                    analysisFailed={analysisErrors.has(row.id)}
                    onToggle={() => selection.toggle(row.id)}
                    onRetry={() => retry(row.id)}
                  />
                ))}
              </div>
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
