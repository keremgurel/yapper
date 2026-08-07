"use client";

import { useState } from "react";
import type { GenErrorKind } from "@/hooks/use-idea-generation";
import type { ContentBlock, ContentHook } from "@/lib/db/schema";

export interface HookGenSource {
  title: string;
  blocks: ContentBlock[];
  originalNote?: string;
}

/**
 * Hook generation, on its own.
 *
 * Deliberately not folded into `useIdeaGeneration`: that one owns a mutually
 * exclusive pair of expensive actions, while this can be fired repeatedly and
 * appends rather than replaces. Sharing its `generating` flag would make each
 * block the other for no reason.
 *
 * `pattern` narrows the request to one archetype. New hooks are appended, so
 * "three more, all stakes-first" adds to the shortlist instead of throwing away
 * the line the creator was already considering.
 */
export function useHookGeneration(
  source: HookGenSource,
  apply: (hooks: ContentHook[]) => void,
) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<GenErrorKind | null>(null);

  const run = async (pattern?: string | null) => {
    if (running || !source.title.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: source.title,
          blocks: source.blocks,
          originalNote: source.originalNote,
          patternId: pattern ?? null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok || !Array.isArray(data.hooks)) {
        setError(
          data.error === "not_entitled"
            ? "locked"
            : res.status === 402
              ? "insufficient"
              : "failed",
        );
        return;
      }
      apply(data.hooks as ContentHook[]);
    } catch {
      setError("failed");
    } finally {
      setRunning(false);
    }
  };

  return { running, error, run };
}
