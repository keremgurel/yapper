"use client";

import { Columns3, Plus, Table2 } from "lucide-react";
import GlassTabs from "@/components/studio-ui/glass-tabs";
import { Button } from "@/components/ui/button";
import type { LibraryView } from "@/lib/views/client";

/**
 * The saved views, as a tab strip.
 *
 * Each tab carries its own kind, grouping, filters and columns, so switching
 * tab changes the whole shape of the surface rather than just narrowing it.
 * The icon says which kind it is before you click, because a board and a table
 * of the same rows are very different things to land on. It is the site
 * hero's capsule at toolbar size, so Studio and ypr.app switch tabs alike.
 *
 * Renders only the tabs and the add button; the bar around it (hairline,
 * settings on the right, loading state) belongs to ViewBar.
 */
export default function ViewTabs({
  views,
  activeId,
  onSelect,
  onAdd,
  busy = false,
}: {
  views: LibraryView[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  busy?: boolean;
}) {
  return (
    <div className="flex max-w-full min-w-0 items-center gap-2">
      <div className="min-w-0 overflow-x-auto p-1">
        <GlassTabs
          id="library-views"
          label="Saved views"
          className="studio-showcase-tabs-compact"
          value={activeId ?? views[0]?.id ?? ""}
          onChange={onSelect}
          tabs={views.map((view) => ({
            value: view.id,
            label: view.name,
            Icon: view.kind === "board" ? Columns3 : Table2,
          }))}
        />
      </div>
      <Button
        variant="outline"
        size="icon"
        className="size-11 shrink-0 rounded-full"
        onClick={onAdd}
        disabled={busy}
        aria-label="New view"
      >
        <Plus className="size-4" aria-hidden />
      </Button>
    </div>
  );
}
