import type { ContentBlock } from "@/lib/db/schema";
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

/**
 * The starter body for an idea begun from a clip, as blocks.
 *
 * These are prompts to write over, not a template the app imposes: the creator
 * can rename, reorder, or delete any of them, which is the difference between
 * this and the fixed columns it replaces. Whatever context the creator attached
 * leads, because it is the only part here they actually wrote.
 */
export function seedBlocks(context: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  if (context.trim()) {
    blocks.push({ label: "Context", kind: "paragraph", text: context.trim() });
  }
  blocks.push(
    { label: "Key points", kind: "bullets", items: [...POINT_TEMPLATES] },
    { label: "The example", kind: "paragraph", text: EXAMPLE_TEMPLATE },
    { label: "Call to action", kind: "paragraph", text: CTA_TEMPLATE },
  );
  return blocks;
}

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
