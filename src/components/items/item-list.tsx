"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

/** Below this many rows a search box is more chrome than help. */
export const SEARCH_THRESHOLD = 8;

/**
 * The list both the Idea bank and the Content Library render: one card of
 * rows with hairlines between them, and a search box that only appears once
 * the list is long enough to need one.
 *
 * Filters, sort headers, saved views and a board mode used to sit above this.
 * None of them answered a question a creator with thirty ideas actually asks,
 * so the list now answers the one they do: "where is the one I'm thinking of".
 */
export default function ItemList({
  total,
  query,
  onQuery,
  children,
  emptyLabel,
  isEmpty,
}: {
  /** How many rows exist before the search narrows them. */
  total: number;
  query: string;
  onQuery: (value: string) => void;
  children: React.ReactNode;
  emptyLabel: string;
  isEmpty: boolean;
}) {
  const searchable = total >= SEARCH_THRESHOLD;
  return (
    <div>
      {searchable && (
        <div className="relative mb-3 max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
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
      )}
      <Card className="divide-border/60 gap-0 divide-y overflow-hidden rounded-xl py-0 shadow-none">
        {isEmpty ? (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            {emptyLabel}
          </p>
        ) : (
          children
        )}
      </Card>
    </div>
  );
}
