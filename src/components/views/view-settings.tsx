"use client";

import { useState } from "react";
import { Check, Settings2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ALL_COLUMN_KEYS, columnDef } from "@/lib/content/columns";
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

function Toggle({
  on,
  label,
  onClick,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
        on
          ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)]/10 text-[color:var(--sg-accent)]"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {on && <Check className="h-3 w-3" />}
      {label}
    </button>
  );
}

/**
 * Everything that makes one view different from another: its name, whether it
 * is a table or a board, what it groups by, what it filters to, and which
 * columns it shows.
 *
 * Column visibility is per view on purpose. A week spent only on short-form
 * has no use for the columns about everything else, and hiding them there
 * should not hide them everywhere.
 */
export default function ViewSettings({
  view,
  onSave,
  onDelete,
}: {
  view: LibraryView;
  onSave: (draft: ViewDraft) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const patch = (fields: Partial<ViewDraft>) =>
    onSave({
      name: view.name,
      kind: view.kind,
      groupBy: view.groupBy,
      filters: view.filters,
      columns: view.columns,
      ...fields,
    });

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
    <div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-muted-foreground h-8"
      >
        <Settings2 className="h-3.5 w-3.5" />
        View
      </Button>

      {open && (
        <div className="border-border bg-card mt-2 space-y-4 rounded-xl border p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
                Name
              </p>
              <Input
                value={view.name}
                onChange={(e) => patch({ name: e.target.value })}
                aria-label="View name"
              />
            </div>
            <div>
              <p className="text-muted-foreground mb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
                Layout
              </p>
              <div className="flex gap-1.5">
                <Toggle
                  on={view.kind === "table"}
                  label="Table"
                  onClick={() => patch({ kind: "table" })}
                />
                <Toggle
                  on={view.kind === "board"}
                  label="Board"
                  onClick={() => patch({ kind: "board" })}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Group by
            </p>
            <div className="flex flex-wrap gap-1.5">
              {GROUPINGS.map((g) => (
                <Toggle
                  key={g.label}
                  on={view.groupBy === g.value}
                  label={g.label}
                  onClick={() => patch({ groupBy: g.value })}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Only show status
            </p>
            <div className="flex flex-wrap gap-1.5">
              {contentStatuses.map((status) => (
                <Toggle
                  key={status}
                  on={filterFor("status").includes(status)}
                  label={STATUS_LABEL[status] ?? status}
                  onClick={() => patchFilter("status", status)}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Only show format
            </p>
            <div className="flex flex-wrap gap-1.5">
              {CONTENT_FORMATS.map((format) => (
                <Toggle
                  key={format.id}
                  on={filterFor("formats").includes(format.id)}
                  label={format.label}
                  onClick={() => patchFilter("formats", format.id)}
                />
              ))}
            </div>
          </div>

          {view.kind === "table" && (
            <div>
              <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
                Columns
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALL_COLUMN_KEYS.filter((key) => key !== "title").map((key) => (
                  <Toggle
                    key={key}
                    on={visible.includes(key)}
                    label={columnDef(key).label || "Actions"}
                    onClick={() => patch({ columns: toggleIn(visible, key) })}
                  />
                ))}
              </div>
              <p className="text-muted-foreground mt-1.5 text-xs">
                Title is always shown.
              </p>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete this view
          </Button>
        </div>
      )}
    </div>
  );
}
