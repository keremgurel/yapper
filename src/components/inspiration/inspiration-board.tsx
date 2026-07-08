"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";

import { Chirpy } from "@/components/brand/chirpy";
import { Button } from "@/components/ui/button";
import ItemCard from "@/components/inspiration/item-card";
import CreatorBadge from "@/components/inspiration/creator-badge";
import CreatorProfile from "@/components/inspiration/creator-profile";
import KindToggle from "@/components/inspiration/kind-toggle";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import { videosByCreator } from "@/lib/inspiration/relations";
import type { InspirationItem, InspirationKind } from "@/lib/inspiration/types";

function matches(item: InspirationItem, q: string): boolean {
  const haystack = [
    item.title,
    item.author,
    item.handle,
    item.note,
    item.transcript,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

const COPY: Record<
  InspirationKind,
  { empty: string; hint: string; cta: string; noun: string }
> = {
  video: {
    empty: "No videos saved here yet",
    hint: "Paste a YouTube, TikTok, or Instagram video to start building your swipe file of hooks, stories, and ideas.",
    cta: "Add a video",
    noun: "video",
  },
  creator: {
    empty: "No creators saved here yet",
    hint: "Paste a creator's profile link to keep the people you learn from in one place — we'll connect their videos as you save them.",
    cta: "Add a creator",
    noun: "creator",
  },
};

export default function InspirationBoard({ onAdd }: { onAdd: () => void }) {
  const { ready, pillars, items, activePillarId } = useInspiration();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<InspirationKind>("video");
  const [creatorFilter, setCreatorFilter] = useState<string | null>(null);
  const [openCreatorId, setOpenCreatorId] = useState<string | null>(null);
  const openCreator = items.find((it) => it.id === openCreatorId) ?? null;

  const creators = useMemo(
    () => items.filter((it) => it.kind === "creator"),
    [items],
  );

  const activePillar = pillars.find((p) => p.id === activePillarId);

  // Everything in the active pillar (both kinds) — drives the toggle counts.
  const scoped = useMemo(
    () =>
      activePillarId === null
        ? items
        : items.filter((it) => it.pillarId === activePillarId),
    [items, activePillarId],
  );

  const counts = useMemo<Record<InspirationKind, number>>(
    () => ({
      video: scoped.filter((it) => it.kind === "video").length,
      creator: scoped.filter((it) => it.kind === "creator").length,
    }),
    [scoped],
  );

  const visible = useMemo(() => {
    let byKind = scoped.filter((it) => it.kind === kind);
    // Creator filter (videos only): keep videos that match the chosen creator.
    if (kind === "video" && creatorFilter) {
      const creator = creators.find((c) => c.id === creatorFilter);
      if (creator) {
        const matchedUrls = new Set(
          videosByCreator(creator, items).map((v) => v.url),
        );
        byKind = byKind.filter((it) => matchedUrls.has(it.url));
      }
    }
    const q = query.trim().toLowerCase();
    return q ? byKind.filter((it) => matches(it, q)) : byKind;
  }, [scoped, kind, query, creatorFilter, creators, items]);

  const copy = COPY[kind];
  const title = activePillar ? activePillar.name : "All inspiration";

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-3xl font-black tracking-tight">
            {title}
          </h1>
          <p className="text-foreground/55 mt-1 text-sm">
            {visible.length}{" "}
            {visible.length === 1 ? copy.noun : `${copy.noun}s`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-foreground/40 pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              className="border-border bg-card text-foreground w-40 rounded-md border py-2 pr-3 pl-9 text-sm outline-none focus:border-[color:var(--sg-accent)] sm:w-52"
            />
          </div>
          <Button
            type="button"
            variant="contrast"
            onClick={onAdd}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add inspiration</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <KindToggle value={kind} onChange={setKind} counts={counts} />
        {kind === "video" && creators.length > 0 && (
          <select
            value={creatorFilter ?? ""}
            onChange={(e) => setCreatorFilter(e.target.value || null)}
            className="border-border bg-card text-foreground/80 cursor-pointer rounded-md border px-3 py-2 text-sm"
            aria-label="Filter by creator"
          >
            <option value="">All creators</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
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
          <Chirpy expression={query ? "oops" : "curious"} size={92} />
          <p className="text-foreground text-base font-bold">
            {query ? "No matches" : copy.empty}
          </p>
          <p className="max-w-sm text-sm">
            {query ? "Try a different search term." : copy.hint}
          </p>
          {!query && (
            <Button
              type="button"
              variant="contrast"
              onClick={onAdd}
              className="mt-2"
            >
              <Plus className="h-4 w-4" />
              {copy.cta}
            </Button>
          )}
        </div>
      ) : kind === "creator" ? (
        <div className="flex flex-wrap gap-3">
          {visible.map((item) => (
            <CreatorBadge
              key={item.id}
              item={item}
              onOpen={() => setOpenCreatorId(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {openCreator && (
        <CreatorProfile
          item={openCreator}
          onClose={() => setOpenCreatorId(null)}
        />
      )}
    </div>
  );
}
