"use client";

import { useState } from "react";
import type { BrainUsed } from "@/lib/brain/context/types";
import type { ContentBlock } from "@/lib/db/schema";
import { parseSections } from "@/lib/ideas/expand-prompt";
import { sectionsToBlocks } from "@/lib/ideas/expansion-patch";

export type GenErrorKind = "insufficient" | "failed" | "locked";
type GenAction = "idea" | "script";
export type GenError = { action: GenAction; kind: GenErrorKind } | null;

/** The fields AI generation reads and writes. */
export interface GenSource {
  title: string;
  hooks: string[];
  /** The adaptive body. Generation replaces it wholesale; it is not merged,
   * because the model chooses a section set per idea and grafting a new set
   * onto an old one produces two half-answers. */
  blocks: ContentBlock[];
  originalNote?: string;
  script?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
}

export type GenApply = (fields: {
  hooks?: string[];
  blocks?: ContentBlock[];
  script?: string;
}) => void;

/** The `used` payload every generate route now returns, guarded because it is
 * a response body and an older deploy will not have sent one. */
function readUsed(data: Record<string, unknown>): BrainUsed | null {
  const used = data.used as Partial<BrainUsed> | undefined;
  if (!used) return null;
  const names = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((name): name is string => typeof name === "string")
      : [];
  const skills = names(used.skills);
  const context = names(used.context);
  return skills.length || context.length ? { skills, context } : null;
}

async function postJson(path: string, body: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { res, data };
}

/**
 * AI generation for one idea/library item: fill the idea fields, or write a
 * full script. Results are applied through the caller's `apply` (client state
 * plus its own save path), so generation is never a second concurrent writer.
 * Only one action runs at a time (each charges a credit), and errors are
 * attributed to the action that raised them.
 */
export function useIdeaGeneration(source: GenSource, apply: GenApply) {
  const [generating, setGenerating] = useState<GenAction | null>(null);
  const [error, setError] = useState<GenError>(null);
  // What the brain contributed to the last run, and which run it was, so the
  // surface can put the line under the thing it applies to.
  const [used, setUsed] = useState<{
    action: GenAction;
    used: BrainUsed;
  } | null>(null);

  const kindFor = (
    res: Response,
    data: Record<string, unknown>,
  ): GenErrorKind =>
    data.error === "not_entitled"
      ? "locked"
      : res.status === 402
        ? "insufficient"
        : "failed";

  const runIdea = async () => {
    if (generating || !source.title.trim()) return;
    setGenerating("idea");
    setError(null);
    setUsed(null);
    try {
      const { res, data } = await postJson("/api/generate/idea", {
        topic: source.title,
        sourceTitle: source.sourceTitle ?? undefined,
        sourceUrl: source.sourceUrl ?? undefined,
      });
      if (!res.ok) {
        setError({ action: "idea", kind: kindFor(res, data) });
        return;
      }
      const readIdea = readUsed(data);
      if (readIdea) setUsed({ action: "idea", used: readIdea });
      const hooks = data.hooks as string[] | undefined;
      const blocks = sectionsToBlocks(parseSections(data.sections));
      apply({
        hooks: hooks?.length ? hooks : source.hooks,
        blocks: blocks.length ? blocks : source.blocks,
      });
    } catch {
      setError({ action: "idea", kind: "failed" });
    } finally {
      setGenerating(null);
    }
  };

  const runScript = async () => {
    if (generating || !source.title.trim()) return;
    setGenerating("script");
    setError(null);
    setUsed(null);
    try {
      const { res, data } = await postJson("/api/generate/script", {
        title: source.title,
        hooks: source.hooks,
        blocks: source.blocks,
        originalNote: source.originalNote,
      });
      if (!res.ok || typeof data.script !== "string") {
        setError({ action: "script", kind: kindFor(res, data) });
        return;
      }
      const readScript = readUsed(data);
      if (readScript) setUsed({ action: "script", used: readScript });
      apply({ script: data.script });
    } catch {
      setError({ action: "script", kind: "failed" });
    } finally {
      setGenerating(null);
    }
  };

  return { generating, error, used, runIdea, runScript };
}
