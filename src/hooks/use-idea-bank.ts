"use client";

import { useCallback, useEffect, useState } from "react";
import { patchContent } from "@/lib/content/client";
import {
  createIdea,
  expandIdeaRemote,
  importSavedReferences,
  listIdeas,
  resolveIdeaSourceRemote,
  type ItemSummary,
} from "@/lib/ideas/client";
import { deriveIdeaType } from "@/lib/ideas/derive-type";
import { expansionToPatch, sourceToPatch } from "@/lib/ideas/expansion-patch";
import { parseCapture } from "@/lib/ideas/parse-capture";
import { useIdeaMigration } from "@/hooks/use-idea-migration";

/**
 * The Idea bank lifecycle, server-backed.
 *
 * Capture writes the creator's exact words to the database FIRST and returns.
 * Reference resolution and AI expansion happen afterwards and patch the same
 * row, so a slow or failed provider can never cost the creator their thought.
 *
 * The creator's pillars and voice are read server-side from their project, so
 * nothing about the brain passes through here.
 */
export function useIdeaBank() {
  const [items, setItems] = useState<ItemSummary[] | null>(null);
  const [working, setWorking] = useState<Set<string>>(new Set());
  const [analysisErrors, setAnalysisErrors] = useState<Set<string>>(new Set());
  // Hand over any ideas still in this browser BEFORE listing, so a returning
  // creator never sees an empty bank where their ideas used to be.
  const { migrating } = useIdeaMigration(true);

  useEffect(() => {
    if (migrating) return;
    let active = true;
    listIdeas().then(
      (rows) => {
        if (active) setItems(rows);
      },
      () => {
        if (active) setItems([]);
      },
    );
    return () => {
      active = false;
    };
  }, [migrating]);

  const mark = (id: string, busy: boolean) =>
    setWorking((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchRow = (id: string, fields: Partial<ItemSummary>) =>
    setItems((prev) =>
      prev ? prev.map((r) => (r.id === id ? { ...r, ...fields } : r)) : prev,
    );

  /**
   * Resolve the reference, then expand. Each step persists as soon as it
   * succeeds, so a failure during expansion still leaves the resolved
   * transcript durably attached to the idea.
   *
   * Takes the note as an argument rather than reading it from state: a freshly
   * captured idea has not landed in `items` yet when this runs.
   */
  const enrich = useCallback(
    async (id: string, url: string | null, note: string) => {
      mark(id, true);
      setAnalysisErrors((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      try {
        let source;
        if (url) {
          source = await resolveIdeaSourceRemote(url);
          const patch = sourceToPatch(source);
          await patchContent(id, patch);
          patchRow(id, {
            sourceTitle: patch.sourceTitle,
            sourcePlatform: patch.sourcePlatform,
            transcriptStatus: patch.transcriptStatus,
          });
        }

        const expansion = await expandIdeaRemote({
          transcript: note || undefined,
          url: url ?? undefined,
          source,
        });
        const patch = expansionToPatch(expansion);
        await patchContent(id, patch);
        patchRow(id, {
          title: patch.title ?? "",
          script: patch.script ?? null,
          pillar: patch.pillar ?? null,
        });
      } catch {
        // The captured words and anything already resolved stay on the row; the
        // creator gets a visible failure and a retry rather than a silent loss.
        setAnalysisErrors((prev) => new Set(prev).add(id));
      } finally {
        mark(id, false);
      }
    },
    [],
  );

  const capture = useCallback(
    async (text: string) => {
      const input = parseCapture(text);
      if (!input.transcript && !input.url) return;
      const note = input.transcript ?? "";

      const item = await createIdea({
        originalNote: note,
        sourceUrl: input.url,
        ideaType: deriveIdeaType(input),
        transcriptStatus: input.url ? "pending" : undefined,
      });
      setItems((prev) => (prev ? [item, ...prev] : [item]));
      void enrich(item.id, input.url ?? null, note);
    },
    [enrich],
  );

  const retry = useCallback(
    (id: string) => {
      const row = items?.find((r) => r.id === id);
      if (row) void enrich(id, row.sourceUrl, row.originalNote);
    },
    [items, enrich],
  );

  const importInstagramSaves = useCallback(
    async (entries: { url: string; title?: string; savedAt?: number }[]) => {
      const imported = await importSavedReferences(entries);
      // Re-read rather than guess which entries were new: the server owns the
      // deduplication, so it owns the resulting list.
      if (imported > 0) setItems(await listIdeas());
      return imported;
    },
    [],
  );

  /** Re-read the bank. The shared bulk actions call this once their mutation
   * lands, so a partially-applied edit can never linger on screen. */
  const refresh = useCallback(async () => {
    try {
      setItems(await listIdeas());
    } catch {
      // Keep what is on screen; the next action will try again.
    }
  }, []);

  return {
    bank: items ?? [],
    loading: migrating || items === null,
    working,
    analysisErrors,
    sourceUrls: (items ?? [])
      .map((r) => r.sourceUrl)
      .filter((u): u is string => Boolean(u)),
    capture,
    importInstagramSaves,
    retry,
    refresh,
  };
}
