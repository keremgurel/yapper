"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Lightbulb, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import BulkBar from "@/components/items/bulk-bar";
import ItemList from "@/components/items/item-list";
import ItemListRow from "@/components/items/item-list-row";
import StatusSelect from "@/components/library/status-select";
import {
  Chip,
  EmptyState,
  PageHeader,
  pillarTone,
} from "@/components/studio-ui";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useContentImport } from "@/hooks/use-content-import";
import { useContentList } from "@/hooks/use-content-list";
import { useItemSelection } from "@/hooks/use-item-selection";
import {
  createContent,
  defaultScheduleDate,
  patchContent,
  type ContentSummary,
} from "@/lib/content/client";
import { relativeTime } from "@/lib/content/relative-time";
import { createOptimisticUpdater } from "@/lib/content/reschedule";
import type { ContentStatus } from "@/lib/db/schema";

/**
 * The Content Library: the ideas you have decided to make, as a list.
 *
 * Each row is a title, its status, its pillar and its age. Opening a row goes
 * to the canvas where the words get written; changing status happens here
 * because that is the one thing you do to many items in a sitting.
 */
export default function ContentLibrary() {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { items, loadFailed, refresh, patchRow } = useContentList(!!isSignedIn);
  const { importing } = useContentImport(!!isSignedIn, refresh);
  const selection = useItemSelection(refresh);
  const [query, setQuery] = useState("");
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

  const rows = useMemo(() => {
    const all = items ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((item) =>
      [item.title, item.originalNote, item.pillar ?? "", item.status]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [items, query]);

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
        <div className="space-y-2" aria-busy>
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
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
        <ItemList
          total={items.length}
          query={query}
          onQuery={setQuery}
          isEmpty={rows.length === 0}
          emptyLabel="Nothing matches that search."
        >
          {rows.map((row) => (
            <ItemListRow
              key={row.id}
              title={row.title.trim() || "Untitled"}
              preview={row.script?.trim() ? null : row.originalNote || null}
              selected={selection.ids.has(row.id)}
              onToggleSelect={() => selection.toggle(row.id)}
              onOpen={() => router.push(`/studio/library/${row.id}`)}
              trailing={
                <>
                  {row.pillar && (
                    <Chip
                      variant="dot"
                      tone={pillarTone(row.pillar)}
                      className="hidden sm:inline-flex"
                    >
                      {row.pillar}
                    </Chip>
                  )}
                  <StatusSelect
                    value={row.status}
                    onChange={(status) => changeStatus(row, status)}
                  />
                  <span className="text-muted-foreground hidden w-10 text-right text-xs tabular-nums sm:inline">
                    {relativeTime(row.updatedAt)}
                  </span>
                </>
              }
            />
          ))}
        </ItemList>
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
    </div>
  );
}
