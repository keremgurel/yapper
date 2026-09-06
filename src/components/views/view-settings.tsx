"use client";

import { Settings2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useAutosave } from "@/hooks/use-autosave";
import { formatTone, statusTone } from "@/components/studio-ui";
import ViewColumnPicker from "@/components/views/view-column-picker";
import ViewFilterChips from "@/components/views/view-filter-chips";
import ViewToggle from "@/components/views/view-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ALL_COLUMN_KEYS } from "@/lib/content/columns";
import { CONTENT_FORMATS } from "@/lib/content/formats";
import { contentStatuses, type LibraryGrouping } from "@/lib/db/schema";
import type { LibraryView, ViewDraft } from "@/lib/views/client";

const GROUPINGS: { value: LibraryGrouping | null; label: string }[] = [
  { value: null, label: "None" },
  { value: "status", label: "Status" },
  { value: "pillar", label: "Pillar" },
  { value: "format", label: "Format" },
];

const STATUS_LABEL: Record<string, string> = {
  drafted: "Drafted",
  planned: "Planned",
  scheduled: "Scheduled",
  posted: "Posted",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-muted-foreground mb-1.5 text-xs font-semibold">
        {label}
      </p>
      {children}
    </div>
  );
}

/**
 * Everything that makes one view different from another: its name, whether it
 * is a table or a board, what it groups by, what it filters to, and which
 * columns it shows. A popover rather than an inline card, so opening it never
 * shoves the table down the page.
 *
 * Column visibility is per view on purpose. A week spent only on short-form
 * has no use for the columns about everything else, and hiding them there
 * should not hide them everywhere.
 */
export default function ViewSettings({
  view: savedView,
  onSave,
  onDelete,
}: {
  view: LibraryView;
  onSave: (
    draft: ViewDraft,
    options?: { keepalive?: boolean },
  ) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [view, setView] = useState<ViewDraft>(() => ({
    name: savedView.name,
    kind: savedView.kind,
    groupBy: savedView.groupBy,
    filters: savedView.filters,
    columns: savedView.columns,
  }));
  const draft = useRef(view);
  const deleting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const { state, queue, flush } = useAutosave<{ draft: ViewDraft }>(
    (fields, options) =>
      fields.draft ? onSave(fields.draft, options) : Promise.resolve(),
    500,
  );
  const patch = (fields: Partial<ViewDraft>) => {
    const next = { ...draft.current, ...fields };
    draft.current = next;
    setView(next);
    queue({ draft: next });
  };
  const remove = async () => {
    if (deleting.current) return;
    deleting.current = true;
    setBusy(true);
    setDeleteError(false);
    try {
      await flush().catch(() => {});
      await onDelete();
    } catch {
      setDeleteError(true);
    } finally {
      deleting.current = false;
      setBusy(false);
    }
  };

  const toggleIn = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  const filterFor = (key: string) => view.filters[key] ?? [];
  const patchFilter = (key: string, id: string) => {
    const next = toggleIn(filterFor(key), id);
    const filters = { ...view.filters };
    if (next.length) filters[key] = next;
    else delete filters[key];
    patch({ filters });
  };

  // An empty saved list means "this surface's defaults", so the picker shows
  // the resolved set and writes an explicit list as soon as you touch it.
  const visible = view.columns.length ? view.columns : ALL_COLUMN_KEYS.slice(0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground h-7 px-2 text-xs"
        >
          <Settings2 aria-hidden className="h-3.5 w-3.5" />
          {state === "error" ? "View options · Unsaved" : "View options"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[min(70vh,var(--radix-popover-content-available-height))] w-80 overflow-y-auto"
      >
        <fieldset disabled={busy} className="space-y-4">
          {state === "error" && (
            <div role="alert" className="text-destructive text-xs">
              Your view changes couldn’t be saved. Your edits are kept here.
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void flush().catch(() => {})}
              >
                Retry
              </button>
            </div>
          )}
          {state === "saving" && (
            <p role="status" className="text-muted-foreground text-xs">
              Saving view…
            </p>
          )}
          {deleteError && (
            <p role="alert" className="text-destructive text-xs">
              This view couldn’t be deleted. Try again.
            </p>
          )}
          <Field label="Name">
            <Input
              value={view.name}
              maxLength={60}
              onChange={(e) => patch({ name: e.target.value })}
              aria-label="View name"
              className="h-8 text-[13px]"
            />
          </Field>

          <Field label="Layout">
            <div className="flex gap-1.5">
              <ViewToggle
                on={view.kind === "table"}
                label="Table"
                onClick={() => patch({ kind: "table" })}
              />
              <ViewToggle
                on={view.kind === "board"}
                label="Board"
                onClick={() => patch({ kind: "board" })}
              />
            </div>
          </Field>

          <Field label="Group by">
            <div
              role="group"
              aria-label="Group by"
              className="flex flex-wrap gap-1.5"
            >
              {GROUPINGS.map((g) => (
                <ViewToggle
                  key={g.label}
                  on={view.groupBy === g.value}
                  label={g.label}
                  onClick={() => patch({ groupBy: g.value })}
                />
              ))}
            </div>
          </Field>

          <Field label="Only show status">
            <ViewFilterChips
              groupLabel="Filter by status"
              options={contentStatuses.map((status) => ({
                id: status,
                label: STATUS_LABEL[status] ?? status,
                tone: statusTone(status),
              }))}
              selected={filterFor("status")}
              onToggle={(id) => patchFilter("status", id)}
            />
          </Field>

          <Field label="Only show format">
            <ViewFilterChips
              groupLabel="Filter by format"
              options={CONTENT_FORMATS.map((format) => ({
                id: format.id,
                label: format.label,
                tone: formatTone(format.id),
              }))}
              selected={filterFor("formats")}
              onToggle={(id) => patchFilter("formats", id)}
            />
          </Field>

          {view.kind === "table" && (
            <Field label="Columns">
              <ViewColumnPicker
                visible={visible}
                onToggle={(key) => patch({ columns: toggleIn(visible, key) })}
              />
            </Field>
          )}

          <div className="border-border/60 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void remove()}
              className="text-muted-foreground hover:text-destructive h-7 px-2 text-xs"
            >
              <Trash2 aria-hidden className="h-3.5 w-3.5" />
              Delete this view
            </Button>
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
