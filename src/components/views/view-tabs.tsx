"use client";

import { Columns3, Plus, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LibraryView } from "@/lib/views/client";

/**
 * The saved views, as a tab strip.
 *
 * Each tab carries its own kind, grouping, filters and columns, so switching
 * tab changes the whole shape of the surface rather than just narrowing it.
 * The icon says which kind it is before you click, because a board and a table
 * of the same rows are very different things to land on.
 *
 * Renders only the tabs and the add button; the bar around it (hairline,
 * settings on the right, loading state) belongs to ViewBar.
 */
export default function ViewTabs({
  views,
  activeId,
  onSelect,
  onAdd,
}: {
  views: LibraryView[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  // Plain buttons with aria-current rather than role="tablist": the ARIA tabs
  // pattern demands roving tabindex and arrow-key movement, and claiming the
  // role without them is worse than not claiming it.
  return (
    <nav aria-label="Saved views" className="flex flex-wrap items-center gap-1">
      {views.map((view) => {
        const active = view.id === activeId;
        const Icon = view.kind === "board" ? Columns3 : Table2;
        return (
          <button
            key={view.id}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(view.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--sg-accent)] focus-visible:outline-none ${
              active
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {view.name}
          </button>
        );
      })}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onAdd}
        className="text-muted-foreground h-7 px-2"
        aria-label="New view"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </nav>
  );
}
