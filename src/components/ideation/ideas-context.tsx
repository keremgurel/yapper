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
  blankIdea,
  loadIdeas,
  saveIdeas,
  type Idea,
} from "@/lib/inspiration/ideas";

interface IdeasContextValue {
  ready: boolean;
  ideas: Idea[];
  addBlank: () => string;
  updateIdea: (id: string, patch: Partial<Idea>) => void;
  deleteIdea: (id: string) => void;
}

const IdeasContext = createContext<IdeasContextValue | null>(null);

export function IdeasProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ideas, setIdeas] = useState<Idea[]>([]);

  // Hydrate from localStorage after mount (client-only store).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setIdeas(loadIdeas());
    setReady(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (ready) saveIdeas(ideas);
  }, [ready, ideas]);

  const addBlank = useCallback((): string => {
    const idea = blankIdea();
    setIdeas((prev) => [idea, ...prev]);
    return idea.id;
  }, []);

  const updateIdea = useCallback((id: string, patch: Partial<Idea>) => {
    setIdeas((prev) =>
      prev.map((idea) =>
        idea.id === id ? { ...idea, ...patch, updatedAt: Date.now() } : idea,
      ),
    );
  }, []);

  const deleteIdea = useCallback((id: string) => {
    setIdeas((prev) => prev.filter((idea) => idea.id !== id));
  }, []);

  const value = useMemo<IdeasContextValue>(
    () => ({ ready, ideas, addBlank, updateIdea, deleteIdea }),
    [ready, ideas, addBlank, updateIdea, deleteIdea],
  );

  return <IdeasContext value={value}>{children}</IdeasContext>;
}

export function useIdeas(): IdeasContextValue {
  const ctx = useContext(IdeasContext);
  if (!ctx) throw new Error("useIdeas must be used within IdeasProvider");
  return ctx;
}
