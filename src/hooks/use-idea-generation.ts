"use client";

import { useState } from "react";

export type GenErrorKind = "insufficient" | "failed" | "locked";
type GenAction = "idea" | "script";
export type GenError = { action: GenAction; kind: GenErrorKind } | null;

/** The fields AI generation reads and writes. Both the legacy localStorage
 * Idea and a Content Library item satisfy this structurally. */
export interface GenSource {
  title: string;
  hooks: string[];
  points: string[];
  example: string;
  cta: string;
  script?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
}

export type GenApply = (fields: {
  hooks?: string[];
  points?: string[];
  example?: string;
  cta?: string;
  script?: string;
}) => void;

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
      const hooks = data.hooks as string[] | undefined;
      const points = data.points as string[] | undefined;
      apply({
        hooks: hooks?.length ? hooks : source.hooks,
        points: points?.length ? points : source.points,
        example: (data.example as string) || source.example,
        cta: (data.cta as string) || source.cta,
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
    try {
      const { res, data } = await postJson("/api/generate/script", {
        title: source.title,
        hooks: source.hooks,
        points: source.points,
        example: source.example,
        cta: source.cta,
      });
      if (!res.ok || typeof data.script !== "string") {
        setError({ action: "script", kind: kindFor(res, data) });
        return;
      }
      apply({ script: data.script });
    } catch {
      setError({ action: "script", kind: "failed" });
    } finally {
      setGenerating(null);
    }
  };

  return { generating, error, runIdea, runScript };
}
