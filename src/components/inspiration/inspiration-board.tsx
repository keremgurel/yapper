"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Sparkles } from "lucide-react";
import ItemCard from "@/components/inspiration/item-card";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import type { InspirationItem } from "@/lib/inspiration/types";

function matches(item: InspirationItem, q: string): boolean {
  const haystack = [item.title, item.author, item.note, item.transcript]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export default function InspirationBoard({ onAdd }: { onAdd: () => void }) {
  const { ready, pillars, items, activePillarId } = useInspiration();
  const [query, setQuery] = useState("");

  const activePillar = pillars.find((p) => p.id === activePillarId);
  const title = activePillar ? activePillar.name : "All inspiration";

  const visible = useMemo(() => {
    const scoped =
      activePillarId === null
        ? items
        : items.filter((it) => it.pillarId === activePillarId);
    const q = query.trim().toLowerCase();
    return q ? scoped.filter((it) => matches(it, q)) : scoped;
  }, [items, activePillarId, query]);

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-black tracking-tight">
            {title}
          </h1>
          <p className="text-foreground/55 mt-1 text-sm">
            {visible.length} {visible.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-foreground/40 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="border-border bg-card text-foreground focus:border-foreground/40 w-40 rounded-full border py-2 pr-3 pl-9 text-sm outline-none sm:w-52"
            />
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="bg-foreground text-background inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add inspiration</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {!ready ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="border-border bg-card overflow-hidden rounded-2xl border"
            >
              <div className="bg-muted aspect-video animate-pulse" />
              <div className="space-y-2 p-3">
                <div className="bg-muted h-4 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-3 w-1/2 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="border-border text-foreground/55 flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed px-6 py-20 text-center">
          <Sparkles className="text-foreground/30 h-8 w-8" />
          <p className="text-foreground text-base font-bold">
            {query ? "No matches" : "Nothing saved here yet"}
          </p>
          <p className="max-w-sm text-sm">
            {query
              ? "Try a different search term."
              : "Paste a YouTube, TikTok, or Instagram link to start building your swipe file of hooks, stories, and ideas."}
          </p>
          {!query && (
            <button
              type="button"
              onClick={onAdd}
              className="bg-foreground text-background mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Add your first link
            </button>
          )}
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
