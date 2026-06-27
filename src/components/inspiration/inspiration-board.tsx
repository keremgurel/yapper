"use client";

import { Plus, Sparkles } from "lucide-react";
import ItemCard from "@/components/inspiration/item-card";
import { useInspiration } from "@/components/inspiration/inspiration-context";

export default function InspirationBoard({ onAdd }: { onAdd: () => void }) {
  const { ready, pillars, items, activePillarId } = useInspiration();

  const activePillar = pillars.find((p) => p.id === activePillarId);
  const title = activePillar ? activePillar.name : "All inspiration";
  const visible =
    activePillarId === null
      ? items
      : items.filter((it) => it.pillarId === activePillarId);

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground text-3xl font-black tracking-tight">
            {title}
          </h1>
          <p className="text-foreground/55 mt-1 text-sm">
            {visible.length} {visible.length === 1 ? "item" : "items"}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="bg-foreground text-background inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add inspiration
        </button>
      </div>

      {ready && visible.length === 0 ? (
        <div className="border-border text-foreground/55 flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-20 text-center">
          <Sparkles className="text-foreground/30 h-8 w-8" />
          <p className="text-foreground text-base font-bold">
            Nothing saved here yet
          </p>
          <p className="max-w-sm text-sm">
            Paste a YouTube, TikTok, or Instagram link to start building your
            swipe file of hooks, stories, and ideas.
          </p>
          <button
            type="button"
            onClick={onAdd}
            className="bg-foreground text-background mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add your first link
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
