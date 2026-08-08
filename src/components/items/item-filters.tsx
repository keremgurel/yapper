"use client";

import { Search, X } from "lucide-react";
import { Toolbar } from "@/components/studio-ui";
import { Input } from "@/components/ui/input";
import PillarSelect from "@/components/library/pillar-select";

/**
 * The filter row above the shared table: free-text search plus a pillar filter.
 * Render-only; the parent owns the values so the filtered list and the
 * select-all checkbox always agree on what "all" means.
 */
export default function ItemFilters({
  query,
  onQuery,
  pillar,
  onPillar,
  pillarOptions,
  resultLabel,
}: {
  query: string;
  onQuery: (value: string) => void;
  pillar: string | null;
  onPillar: (value: string | null) => void;
  pillarOptions: string[];
  resultLabel: string | null;
}) {
  return (
    <Toolbar
      end={
        resultLabel && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {resultLabel}
          </span>
        )
      }
    >
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search"
          className="h-9 pl-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {pillarOptions.length > 0 && (
        <PillarSelect
          value={pillar}
          onChange={onPillar}
          options={pillarOptions}
          emptyLabel="All pillars"
          ariaLabel="Filter by pillar"
        />
      )}
    </Toolbar>
  );
}
