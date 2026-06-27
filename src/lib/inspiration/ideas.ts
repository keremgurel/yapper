import { newId } from "@/lib/inspiration/store";
import type { InspirationItem } from "@/lib/inspiration/types";

export interface Idea {
  id: string;
  title: string;
  hooks: string[];
  points: string[];
  example: string;
  cta: string;
  sourceItemId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  pillarId?: string | null;
  createdAt: number;
  updatedAt: number;
}

const IDEAS_KEY = "yapper-inspiration-ideas-v1";

function hookTemplates(topic: string): string[] {
  const t = topic.trim() || "this";
  return [
    `Most people get ${t} completely wrong.`,
    `Here's what nobody tells you about ${t}.`,
    `I changed my mind about ${t} — here's why.`,
  ];
}

const POINT_TEMPLATES = [
  "The core idea in one sentence.",
  "Why it matters — the stakes.",
  "One counterintuitive detail people miss.",
];

const EXAMPLE_TEMPLATE = "A specific moment or story that proves the point.";
const CTA_TEMPLATE = "Save this if it helped, and follow for more.";

export function blankIdea(seed?: {
  title?: string;
  sourceItemId?: string;
  sourceTitle?: string;
  sourceUrl?: string;
  pillarId?: string | null;
}): Idea {
  const now = Date.now();
  const title = seed?.title?.trim() || "Untitled idea";
  return {
    id: newId("idea"),
    title,
    hooks: hookTemplates(seed?.title ?? ""),
    points: [...POINT_TEMPLATES],
    example: EXAMPLE_TEMPLATE,
    cta: CTA_TEMPLATE,
    sourceItemId: seed?.sourceItemId,
    sourceTitle: seed?.sourceTitle,
    sourceUrl: seed?.sourceUrl,
    pillarId: seed?.pillarId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function loadIdeas(): Idea[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IDEAS_KEY);
    return raw ? (JSON.parse(raw) as Idea[]) : [];
  } catch {
    return [];
  }
}

export function saveIdeas(ideas: Idea[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IDEAS_KEY, JSON.stringify(ideas));
  } catch {
    // ignore quota errors for this local-first MVP
  }
}

/** Create an idea seeded from a saved inspiration item and persist it. */
export function addIdeaFromItem(item: InspirationItem): string {
  const idea = blankIdea({
    title: item.title,
    sourceItemId: item.id,
    sourceTitle: item.title,
    sourceUrl: item.url,
    pillarId: item.pillarId,
  });
  saveIdeas([idea, ...loadIdeas()]);
  return idea.id;
}
