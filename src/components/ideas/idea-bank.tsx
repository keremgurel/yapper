"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Lightbulb, Loader2 } from "lucide-react";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import { useItemSelection } from "@/hooks/use-item-selection";
import IdeaCapture from "@/components/ideas/idea-capture";
import InstagramImportSheet from "@/components/ideas/instagram-import-sheet";
import BulkBar from "@/components/items/bulk-bar";
import ItemList from "@/components/items/item-list";
import ItemListRow from "@/components/items/item-list-row";
import {
  Chip,
  EmptyState,
  PageHeader,
  pillarTone,
} from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/content/relative-time";
import type { ItemSummary } from "@/lib/ideas/client";

/**
 * The Idea bank: a place to put a thought down, and the list of what is there.
 *
 * Capture at the top, list below, nothing else. Opening an idea goes to its
 * canvas, where it gets developed; selecting rows brings up the bulk bar,
 * which is how ideas move to the Library.
 */
export default function IdeaBank() {
  const router = useRouter();
  const {
    bank,
    loading,
    loadFailed,
    refreshFailed,
    working,
    analysisErrors,
    sourceUrls,
    capture,
    importInstagramSaves,
    retry,
    refresh,
  } = useIdeaBank();
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selection = useItemSelection(refresh);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bank;
    return bank.filter((item) =>
      [item.title, item.originalNote, item.sourceTitle ?? "", item.pillar ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [bank, query]);

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
          <div className="space-y-2" aria-busy>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : bank.length === 0 ? (
          <EmptyState
            icon={Lightbulb}
            title="Nothing here yet"
            description="Write or dictate a thought above. It lands here."
          />
        ) : (
          <ItemList
            total={bank.length}
            query={query}
            onQuery={setQuery}
            isEmpty={rows.length === 0}
            emptyLabel="Nothing matches that search."
          >
            {rows.map((item) => (
              <ItemListRow
                key={item.id}
                title={titleOf(item)}
                preview={previewOf(item)}
                selected={selection.ids.has(item.id)}
                onToggleSelect={() => selection.toggle(item.id)}
                onOpen={() => router.push(`/studio/library/${item.id}`)}
                trailing={
                  <IdeaRowTrailing
                    item={item}
                    working={working.has(item.id)}
                    failed={analysisErrors.has(item.id)}
                    onRetry={() => retry(item.id)}
                  />
                }
              />
            ))}
          </ItemList>
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

/** Pillar, then either the age of the idea or what is happening to it. */
function IdeaRowTrailing({
  item,
  working,
  failed,
  onRetry,
}: {
  item: ItemSummary;
  working: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {item.pillar && (
        <Chip
          variant="dot"
          tone={pillarTone(item.pillar)}
          className="hidden sm:inline-flex"
        >
          {item.pillar}
        </Chip>
      )}
      {working ? (
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
          Reading
        </span>
      ) : failed ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-xs font-semibold text-[color-mix(in_oklab,var(--sg-yellow-500)_48%,var(--sg-text))] underline-offset-2 hover:underline"
        >
          Couldn’t read it · Retry
        </button>
      ) : (
        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
          {relativeTime(item.updatedAt)}
        </span>
      )}
    </>
  );
}

function titleOf(item: ItemSummary): string {
  return (
    item.title ||
    firstLine(item.originalNote) ||
    item.sourceTitle ||
    item.sourceUrl ||
    "New idea"
  );
}

/** The captured words, unless the title still is the captured words. */
function previewOf(item: ItemSummary): string | null {
  if (item.title && item.originalNote) return item.originalNote;
  if (!item.title && item.sourceTitle && item.originalNote)
    return item.sourceTitle;
  return null;
}

function firstLine(text: string): string {
  const line = text.split(/[.\n]/)[0]?.trim() ?? "";
  return line.length > 80 ? line.slice(0, 80) : line;
}
