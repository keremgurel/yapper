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
  return (
    <div className="border-border flex flex-wrap items-center gap-1 border-b pb-px">
      {views.map((view) => {
        const active = view.id === activeId;
        const Icon = view.kind === "board" ? Columns3 : Table2;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onSelect(view.id)}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[13px] font-bold transition-colors ${
              active
                ? "text-foreground border-[color:var(--sg-accent)]"
                : "text-muted-foreground hover:text-foreground border-transparent"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
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
    </div>
  );
}
