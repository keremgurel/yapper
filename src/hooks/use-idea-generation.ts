"use client";

import { useState } from "react";
import { useIdeas } from "@/components/ideation/ideas-context";
import type { Idea } from "@/lib/inspiration/ideas";

export type GenError = "insufficient" | "failed" | null;

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
 * AI generation for a single idea: fill the idea fields, or write a full
 * script. Both hit charge-on-success endpoints and apply the result through
 * the ideas store. Tracks which action is in flight so the UI can show it.
 */
export function useIdeaGeneration(idea: Idea) {
  const { updateIdea } = useIdeas();
  const [generating, setGenerating] = useState<"idea" | "script" | null>(null);
  const [error, setError] = useState<GenError>(null);

  const errorFor = (res: Response): GenError =>
    res.status === 402 ? "insufficient" : "failed";

  const runIdea = async () => {
    if (!idea.title.trim()) return;
    setGenerating("idea");
    setError(null);
    try {
      const { res, data } = await postJson("/api/generate/idea", {
        topic: idea.title,
        sourceTitle: idea.sourceTitle,
        sourceUrl: idea.sourceUrl,
      });
      if (!res.ok) return setError(errorFor(res));
      const hooks = data.hooks as string[] | undefined;
      const points = data.points as string[] | undefined;
      updateIdea(idea.id, {
        hooks: hooks?.length ? hooks : idea.hooks,
        points: points?.length ? points : idea.points,
        example: (data.example as string) || idea.example,
        cta: (data.cta as string) || idea.cta,
      });
    } catch {
      setError("failed");
    } finally {
      setGenerating(null);
    }
  };

  const runScript = async () => {
    if (!idea.title.trim()) return;
    setGenerating("script");
    setError(null);
    try {
      const { res, data } = await postJson("/api/generate/script", {
        title: idea.title,
        hooks: idea.hooks,
        points: idea.points,
        example: idea.example,
        cta: idea.cta,
      });
      if (!res.ok || typeof data.script !== "string") {
        return setError(errorFor(res));
      }
      updateIdea(idea.id, { script: data.script });
    } catch {
      setError("failed");
    } finally {
      setGenerating(null);
    }
  };

  return { generating, error, runIdea, runScript };
}
