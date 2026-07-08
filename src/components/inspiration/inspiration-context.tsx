"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  loadItems,
  loadPillars,
  newId,
  saveItems,
  savePillars,
} from "@/lib/inspiration/store";
import type {
  InspirationItem,
  Pillar,
  ResolvedLink,
} from "@/lib/inspiration/types";

interface InspirationContextValue {
  ready: boolean;
  pillars: Pillar[];
  items: InspirationItem[];
  activePillarId: string | null;
  setActivePillarId: (id: string | null) => void;
  addPillar: (name: string) => string | null;
  renamePillar: (id: string, name: string) => void;
  deletePillar: (id: string) => void;
  addItem: (
    url: string,
    resolved: ResolvedLink,
    pillarId: string | null,
    opts?: { note?: string; creatorItemId?: string },
  ) => string;
  updateItem: (id: string, patch: Partial<InspirationItem>) => void;
  deleteItem: (id: string) => void;
  moveItem: (id: string, pillarId: string | null) => void;
  setItemNote: (id: string, note: string) => void;
  /** Scrape (or re-scrape) a creator's feed via Apify and store the ranked
   * videos on the item. No-op for non-creator items. Accepts just the fields it
   * reads so the add flow can trigger a scrape right after saving. */
  refreshCreator: (item: CreatorRef) => Promise<void>;
  /** Ids currently being scraped, for per-card loading state. */
  scrapingIds: string[];
}

/** The subset of a creator item that `refreshCreator` needs to scrape it. */
type CreatorRef = Pick<
  InspirationItem,
  "id" | "kind" | "url" | "thumbnail" | "title"
>;

const InspirationContext = createContext<InspirationContextValue | null>(null);

export function InspirationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [activePillarId, setActivePillarId] = useState<string | null>(null);

  // Hydrate the persisted library from localStorage after mount. This is the
  // hydration-safe pattern for a client-only store (lazy init would diverge from
  // the server render).
  useEffect(() => {
    setPillars(loadPillars());
    setItems(loadItems());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) savePillars(pillars);
  }, [ready, pillars]);

  useEffect(() => {
    if (ready) saveItems(items);
  }, [ready, items]);

  const addPillar = useCallback((name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = newId("pillar");
    setPillars((prev) => [
      ...prev,
      { id, name: trimmed, createdAt: Date.now() },
    ]);
    return id;
  }, []);

  const renamePillar = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPillars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
    );
  }, []);

  const deletePillar = useCallback((id: string) => {
    setPillars((prev) => prev.filter((p) => p.id !== id));
    setItems((prev) =>
      prev.map((it) => (it.pillarId === id ? { ...it, pillarId: null } : it)),
    );
    setActivePillarId((cur) => (cur === id ? null : cur));
  }, []);

  const addItem = useCallback(
    (
      url: string,
      resolved: ResolvedLink,
      pillarId: string | null,
      opts?: { note?: string; creatorItemId?: string },
    ): string => {
      const id = newId("item");
      const item: InspirationItem = {
        id,
        kind: resolved.kind,
        pillarId,
        url,
        platform: resolved.platform,
        title: resolved.title,
        author: resolved.author,
        handle: resolved.handle,
        creatorItemId:
          resolved.kind === "video" ? opts?.creatorItemId : undefined,
        thumbnail: resolved.thumbnail,
        transcript: resolved.transcript,
        note: opts?.note?.trim() || undefined,
        createdAt: Date.now(),
      };
      setItems((prev) => [item, ...prev]);
      return id;
    },
    [],
  );

  const updateItem = useCallback(
    (id: string, patch: Partial<InspirationItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
    },
    [],
  );

  const [scrapingIds, setScrapingIds] = useState<string[]>([]);

  const refreshCreator = useCallback(
    async (item: CreatorRef) => {
      if (item.kind !== "creator") return;
      setScrapingIds((prev) =>
        prev.includes(item.id) ? prev : [...prev, item.id],
      );
      try {
        const res = await fetch("/api/inspiration/creator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: item.url }),
        });
        const data = (await res.json()) as {
          name?: string;
          avatar?: string;
          videos?: InspirationItem["videos"];
          scrapedAt?: number;
        };
        updateItem(item.id, {
          videos: data.videos ?? [],
          scrapedAt: data.scrapedAt ?? Date.now(),
          ...(data.avatar && !item.thumbnail ? { thumbnail: data.avatar } : {}),
          ...(data.name && item.title.startsWith("@")
            ? { title: data.name }
            : {}),
        });
      } catch {
        // Leave the item as-is; the UI shows a retry affordance.
        updateItem(item.id, { scrapedAt: Date.now() });
      } finally {
        setScrapingIds((prev) => prev.filter((x) => x !== item.id));
      }
    },
    [updateItem],
  );

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const moveItem = useCallback((id: string, pillarId: string | null) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, pillarId } : it)),
    );
  }, []);

  const setItemNote = useCallback((id: string, note: string) => {
    const trimmed = note.trim();
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, note: trimmed || undefined } : it,
      ),
    );
  }, []);

  const value = useMemo<InspirationContextValue>(
    () => ({
      ready,
      pillars,
      items,
      activePillarId,
      setActivePillarId,
      addPillar,
      renamePillar,
      deletePillar,
      addItem,
      updateItem,
      deleteItem,
      moveItem,
      setItemNote,
      refreshCreator,
      scrapingIds,
    }),
    [
      ready,
      pillars,
      items,
      activePillarId,
      addPillar,
      renamePillar,
      deletePillar,
      addItem,
      updateItem,
      deleteItem,
      moveItem,
      setItemNote,
      refreshCreator,
      scrapingIds,
    ],
  );

  return <InspirationContext value={value}>{children}</InspirationContext>;
}

export function useInspiration(): InspirationContextValue {
  const ctx = useContext(InspirationContext);
  if (!ctx) {
    throw new Error("useInspiration must be used within InspirationProvider");
  }
  return ctx;
}
