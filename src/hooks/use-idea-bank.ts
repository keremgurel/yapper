"use client";

import { useCallback, useEffect, useState } from "react";
import {
  curateIdea,
  expandIdeaRemote,
  resolveIdeaSourceRemote,
} from "@/lib/ideas/client";
import { parseCapture } from "@/lib/ideas/parse-capture";
import {
  addIdea,
  addIdeas,
  loadIdeas,
  newIdea,
  removeIdeas,
  setExpansion,
  updateIdea,
} from "@/lib/ideas/store";
import type { Idea } from "@/lib/ideas/types";
import type { InstagramSavedEntry } from "@/lib/ideas/instagram-saved-import";
import { normalizeInspoUrl } from "@/lib/inspiration/dedupe";

/**
 * The Idea bank lifecycle: capture a raw idea, auto-expand it in the background
 * (the original words are stored the instant it is captured, so nothing is ever
 * lost if the AI is slow or fails), and curate chosen ideas into the Content
 * Library. Selection lives in the view; this hook owns the data.
 */
export function useIdeaBank(pillars: string[] = []) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [expanding, setExpanding] = useState<Set<string>>(new Set());
  const [analysisErrors, setAnalysisErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIdeas(loadIdeas());
  }, []);

  const resolveAndExpand = useCallback(
    async (idea: Idea) => {
      setExpanding((s) => new Set(s).add(idea.id));
      setAnalysisErrors((s) => {
        const next = new Set(s);
        next.delete(idea.id);
        return next;
      });
      try {
        let current = idea;
        if (idea.source?.url) {
          // The reference is part of the idea, not optional context. Resolution
          // must succeed before expansion so AI never invents source mechanics
          // from the creator's note alone.
          const source = await resolveIdeaSourceRemote(idea.source.url);
          current = { ...idea, source };
          setIdeas(updateIdea(idea.id, { source }));
        }
        const expansion = await expandIdeaRemote(
          {
            transcript: current.originalTranscript || undefined,
            url: current.source?.url,
            source: current.source,
          },
          pillars,
        );
        setIdeas(setExpansion(idea.id, expansion));
      } catch {
        // Keep the last durable draft, surface the failure, and offer a retry.
        setAnalysisErrors((s) => new Set(s).add(idea.id));
      } finally {
        setExpanding((s) => {
          const n = new Set(s);
          n.delete(idea.id);
          return n;
        });
      }
    },
    [pillars],
  );

  const capture = useCallback(
    (text: string) => {
      const input = parseCapture(text);
      if (!input.transcript && !input.url) return;
      const idea = newIdea(input);
      setIdeas(addIdea(idea)); // shows up immediately, details fill in async
      void resolveAndExpand(idea);
    },
    [resolveAndExpand],
  );

  const importInstagramSaves = useCallback(
    (entries: InstagramSavedEntry[]): number => {
      const existing = new Set(
        loadIdeas()
          .map((idea) => idea.source?.url)
          .filter((url): url is string => Boolean(url))
          .map(normalizeInspoUrl),
      );
      const imported: Idea[] = [];
      for (const entry of entries) {
        const key = normalizeInspoUrl(entry.url);
        if (existing.has(key)) continue;
        existing.add(key);
        imported.push(
          newIdea({
            url: entry.url,
            source: {
              url: entry.url,
              title: entry.title,
              platform: "instagram",
              collection: entry.collection,
              savedAt: entry.savedAt,
            },
          }),
        );
      }
      if (imported.length) setIdeas(addIdeas(imported));
      return imported.length;
    },
    [],
  );

  const retry = useCallback(
    (id: string) => {
      const idea = loadIdeas().find((i) => i.id === id);
      if (idea) void resolveAndExpand(idea);
    },
    [resolveAndExpand],
  );

  const remove = useCallback((ids: Set<string>) => {
    setIdeas(removeIdeas(ids));
  }, []);

  const curate = useCallback(
    async (ids: Set<string>) => {
      const chosen = ideas.filter((i) => ids.has(i.id));
      // Promote each into the Content Library; keep the original in the bank
      // (marked drafted, so it leaves the inbox) as the record of your words.
      await Promise.allSettled(chosen.map((i) => curateIdea(i)));
      let next = ideas;
      for (const i of chosen) next = updateIdea(i.id, { stage: "drafted" });
      setIdeas(next);
    },
    [ideas],
  );

  const bank = ideas.filter((i) => i.stage === "bank");
  return {
    bank,
    sourceUrls: ideas
      .map((idea) => idea.source?.url)
      .filter((url): url is string => Boolean(url)),
    expanding,
    analysisErrors,
    capture,
    importInstagramSaves,
    retry,
    remove,
    curate,
  };
}
