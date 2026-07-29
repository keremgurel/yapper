import { newId } from "@/lib/inspiration/store";
import { deriveIdeaType } from "@/lib/ideas/derive-type";
import type { Idea, IdeaExpansion, IdeaInput } from "@/lib/ideas/types";

/**
 * Local-first persistence for the Idea bank. Mirrors how Inspiration items are
 * already stored, so the desktop app has a working database on day one with no
 * server round-trip and no schema migration. Cloud sync (Postgres) is a later,
 * additive step; curating an idea already promotes it into the Content Library.
 */
const IDEAS_KEY = "yapper-idea-bank-v1";

function read(): Idea[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IDEAS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Idea[]) : [];
  } catch {
    return [];
  }
}

function write(ideas: Idea[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
  } catch {
    // storage full or unavailable; local-first MVP tolerates a dropped write
  }
}

export function loadIdeas(): Idea[] {
  return read().sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Build a new idea from raw input. The creator's exact words are captured
 * verbatim into `originalTranscript` and never touched again; the type is
 * derived from what they gave us. The expansion is attached later (async), so a
 * freshly captured idea shows up immediately and fills in when the AI returns.
 */
export function newIdea(
  input: IdeaInput,
  pillarId: string | null = null,
): Idea {
  const now = Date.now();
  return {
    id: newId("idea"),
    type: deriveIdeaType(input),
    stage: "bank",
    originalTranscript: input.transcript?.trim() ?? "",
    source: input.source ?? (input.url ? { url: input.url } : undefined),
    pillarId,
    createdAt: now,
    updatedAt: now,
  };
}

export function addIdea(idea: Idea): Idea[] {
  const next = [idea, ...read()];
  write(next);
  return next;
}

export function setExpansion(id: string, expansion: IdeaExpansion): Idea[] {
  const next = read().map((i) =>
    i.id === id ? { ...i, expansion, updatedAt: Date.now() } : i,
  );
  write(next);
  return next;
}

export function updateIdea(id: string, patch: Partial<Idea>): Idea[] {
  const next = read().map((i) =>
    i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i,
  );
  write(next);
  return next;
}

export function removeIdeas(ids: Set<string>): Idea[] {
  const next = read().filter((i) => !ids.has(i.id));
  write(next);
  return next;
}
