"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Lightbulb, Sparkles } from "lucide-react";
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
import LabOverview, { LabSwitchLink } from "@/components/items/lab-overview";
import { EmptyState } from "@/components/studio-ui";
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

  const [view, setView] = useState<BankView>("cards");
  const [importOpen, setImportOpen] = useState(false);
  const filters = useItemFilters(bank);
  const { sort, toggle: toggleSort, sorted } = useContentSort(filters.filtered);
  const selection = useItemSelection(refresh);

  const rows = sorted ?? [];

  return (
    <div className="w-full pb-24">
      <LabOverview
        mode="ideas"
        items={loading ? null : bank}
        action={<LabSwitchLink mode="ideas" />}
      />

      <section aria-labelledby="quick-capture-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-[0.14em] text-[color:var(--sg-accent-strong)] uppercase">
              Start here
            </p>
            <h2
              id="quick-capture-title"
              className="font-display text-foreground mt-1 text-2xl font-semibold tracking-[-0.04em]"
            >
              Quick capture
            </h2>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            title="Step-by-step Instagram saved-post import"
          >
            <Archive className="h-3.5 w-3.5" />
            Import Instagram saves
          </Button>
        </div>
        <p className="text-muted-foreground mb-3 max-w-2xl text-sm leading-6">
          Write the unfinished version. Add a reference link if there is
          one—Yapper keeps your words separate from the source and the AI
          expansion.
        </p>
        <IdeaCapture onCapture={capture} />
      </section>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.14em] text-[color:var(--sg-accent-strong)] uppercase">
              <Sparkles className="h-3.5 w-3.5" /> Curate next
            </p>
            <h2 className="font-display text-foreground mt-1 text-2xl font-semibold tracking-[-0.04em]">
              Your idea bank
            </h2>
          </div>
          <p className="text-muted-foreground max-w-md text-xs leading-5 sm:text-right">
            Open an idea to develop it. Select one or more to send them into the
            production pipeline.
          </p>
        </div>
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
