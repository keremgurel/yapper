"use client";

import { Check, FileJson, FolderOpen } from "lucide-react";

export interface CollectionCount {
  total: number;
  newItems: number;
}

/**
 * The post-upload half of the import sheet: what was found in the archive and
 * which collections come along. Render-only; the sheet owns selection.
 */
export default function InstagramCollectionList({
  filename,
  entryCount,
  duplicateCount,
  collections,
  selected,
  onToggle,
  onToggleAll,
  onReset,
}: {
  filename: string;
  entryCount: number;
  duplicateCount: number;
  collections: [string, CollectionCount][];
  selected: Set<string>;
  onToggle: (name: string) => void;
  onToggleAll: () => void;
  onReset: () => void;
}) {
  return (
    <div>
      <div className="border-border bg-card flex items-start gap-3 rounded-xl border p-3.5">
        <FileJson className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-semibold">
            {filename}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {entryCount} unique saves found
            {duplicateCount ? ` · ${duplicateCount} already in Idea Bank` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-muted-foreground hover:text-foreground text-xs font-semibold"
        >
          Change
        </button>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-foreground text-sm font-semibold">
            Choose collections
          </h3>
          <p className="text-muted-foreground mt-1 text-xs">
            Collection names are preserved on imported references.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleAll}
          className="text-xs font-semibold text-[color:var(--sg-accent)]"
        >
          {selected.size === collections.length ? "Clear all" : "Select all"}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        {collections.map(([name, count]) => {
          const checked = selected.has(name);
          return (
            <button
              key={name}
              type="button"
              onClick={() => onToggle(name)}
              aria-pressed={checked}
              className={`border-border flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
                checked ? "bg-[color:var(--sg-accent)]/8" : "hover:bg-muted/50"
              }`}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${
                  checked
                    ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-white"
                    : "border-border"
                }`}
              >
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <FolderOpen className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">
                {name}
              </span>
              <span className="text-muted-foreground text-xs">
                {count.newItems === count.total
                  ? count.total
                  : `${count.newItems} new`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
