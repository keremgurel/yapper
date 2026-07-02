"use client";

import { useState } from "react";
import { useIdeas } from "@/components/ideation/ideas-context";
import type { Idea } from "@/lib/inspiration/ideas";

export type GenErrorKind = "insufficient" | "failed";
type GenAction = "idea" | "script";
export type GenError = { action: GenAction; kind: GenErrorKind } | null;

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
 * the ideas store. Only one action runs at a time (each charges a credit), and
 * errors are attributed to the action that raised them so the UI can show the
 * message next to the right button.
 */
export function useIdeaGeneration(idea: Idea) {
  const { updateIdea } = useIdeas();
  const [generating, setGenerating] = useState<GenAction | null>(null);
  const [error, setError] = useState<GenError>(null);

  const kindFor = (res: Response): GenErrorKind =>
    res.status === 402 ? "insufficient" : "failed";

  const runIdea = async () => {
    if (generating || !idea.title.trim()) return;
    setGenerating("idea");
    setError(null);
    try {
      const { res, data } = await postJson("/api/generate/idea", {
        topic: idea.title,
        sourceTitle: idea.sourceTitle,
        sourceUrl: idea.sourceUrl,
      });
      if (!res.ok) {
        setError({ action: "idea", kind: kindFor(res) });
        return;
      }
      const hooks = data.hooks as string[] | undefined;
      const points = data.points as string[] | undefined;
      updateIdea(idea.id, {
        hooks: hooks?.length ? hooks : idea.hooks,
        points: points?.length ? points : idea.points,
        example: (data.example as string) || idea.example,
        cta: (data.cta as string) || idea.cta,
      });
    } catch {
      setError({ action: "idea", kind: "failed" });
    } finally {
      setGenerating(null);
    }
  };

  const runScript = async () => {
    if (generating || !idea.title.trim()) return;
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
        setError({ action: "script", kind: kindFor(res) });
        return;
      }
      updateIdea(idea.id, { script: data.script });
    } catch {
      setError({ action: "script", kind: "failed" });
    } finally {
      setGenerating(null);
    }
  };

  return { generating, error, runIdea, runScript };
}
