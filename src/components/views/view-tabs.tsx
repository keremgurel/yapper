"use client";

import { Columns3, Plus, Table2 } from "lucide-react";
import { GlassButton, GlassTabs } from "@glass-sdk/liquid-glass";
import { StudioGlassScene } from "@/components/studio-ui/liquid-glass";
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
        <StudioGlassScene className="w-max rounded-full">
          <GlassTabs
            aria-label="Saved views"
            value={activeId}
            onValueChange={(id) => {
              if (typeof id === "string") onSelect(id);
            }}
            items={views.map((view) => {
              const Icon = view.kind === "board" ? Columns3 : Table2;
              return {
                value: view.id,
                label: (
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Icon aria-hidden className="size-3.5" />
                    {view.name}
                  </span>
                ),
              };
            })}
          />
        </StudioGlassScene>
      </div>
      <StudioGlassScene className="shrink-0 rounded-full">
        <GlassButton
          size="icon"
          onClick={onAdd}
          disabled={busy}
          aria-label="New view"
        >
          <Plus className="size-4" aria-hidden />
        </GlassButton>
      </StudioGlassScene>
    </div>
  );
}
