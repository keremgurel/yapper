"use client";

import { useCallback, useEffect, useState } from "react";
import { curateIdea, expandIdeaRemote } from "@/lib/ideas/client";
import { parseCapture } from "@/lib/ideas/parse-capture";
import {
  addIdea,
  loadIdeas,
  newIdea,
  removeIdeas,
  setExpansion,
  updateIdea,
} from "@/lib/ideas/store";
import type { Idea } from "@/lib/ideas/types";

/**
 * The Idea bank lifecycle: capture a raw idea, auto-expand it in the background
 * (the original words are stored the instant it is captured, so nothing is ever
 * lost if the AI is slow or fails), and curate chosen ideas into the Content
 * Library. Selection lives in the view; this hook owns the data.
 */
export function useIdeaBank(pillars: string[] = []) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [expanding, setExpanding] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIdeas(loadIdeas());
  }, []);

  const runExpand = useCallback(
    async (idea: Idea) => {
      setExpanding((s) => new Set(s).add(idea.id));
      try {
        const expansion = await expandIdeaRemote(
          {
            transcript: idea.originalTranscript || undefined,
            url: idea.source?.url,
            source: idea.source,
          },
          pillars,
        );
        setIdeas(setExpansion(idea.id, expansion));
      } catch {
        // Leave it un-expanded in the bank; the card offers a retry.
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
      setIdeas(addIdea(idea)); // shows up immediately, expansion fills in async
      void runExpand(idea);
    },
    [runExpand],
  );

  const retry = useCallback(
    (id: string) => {
      const idea = loadIdeas().find((i) => i.id === id);
      if (idea) void runExpand(idea);
    },
    [runExpand],
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
  return { bank, expanding, capture, retry, remove, curate };
}
