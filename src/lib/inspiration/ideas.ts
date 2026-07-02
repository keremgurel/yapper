import { newId } from "@/lib/inspiration/store";

export interface Idea {
  id: string;
  title: string;
  hooks: string[];
  points: string[];
  example: string;
  cta: string;
  /** Optional full spoken-word script (opt-in AI generation), read off the
   * teleprompter. Absent until generated or hand-written. */
  script?: string;
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
    `I changed my mind about ${t}, and here's why.`,
  ];
}

const POINT_TEMPLATES = [
  "The core idea in one sentence.",
  "Why it matters (the stakes).",
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

/**
 * Read the legacy localStorage ideas. Ideas now live in the Content Library
 * (DB); this remains only for the one-time import and the recorder's legacy
 * ?idea= links. Nothing writes this store anymore.
 */
export function loadIdeas(): Idea[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IDEAS_KEY);
    return raw ? (JSON.parse(raw) as Idea[]) : [];
  } catch {
    return [];
  }
}
