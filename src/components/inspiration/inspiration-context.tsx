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
  ) => void;
  deleteItem: (id: string) => void;
  moveItem: (id: string, pillarId: string | null) => void;
  setItemNote: (id: string, note: string) => void;
}

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
  // the server render); the lint rule for setState-in-effect is intentionally
  // relaxed here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPillars(loadPillars());
    setItems(loadItems());
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    (url: string, resolved: ResolvedLink, pillarId: string | null) => {
      const item: InspirationItem = {
        id: newId("item"),
        pillarId,
        url,
        platform: resolved.platform,
        title: resolved.title,
        author: resolved.author,
        thumbnail: resolved.thumbnail,
        transcript: resolved.transcript,
        createdAt: Date.now(),
      };
      setItems((prev) => [item, ...prev]);
    },
    [],
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
      deleteItem,
      moveItem,
      setItemNote,
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
      deleteItem,
      moveItem,
      setItemNote,
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
