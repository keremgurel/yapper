"use client";

import { useCallback, useMemo, useState } from "react";
import { bulkItems } from "@/lib/ideas/client";
import type { ContentStage, ContentStatus } from "@/lib/db/schema";

/**
 * Multi-select plus the bulk mutations both surfaces expose.
 *
 * Every action is optimistic and then confirmed by the caller's `onDone`,
 * which re-reads the list. Doing the re-read in one place is what keeps a
 * partially-applied bulk edit (an id the server rejected) from lingering on
 * screen as if it had worked.
 */
export function useItemSelection(onDone: () => void | Promise<void>) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((all: string[]) => setIds(new Set(all)), []);
  const clear = useCallback(() => setIds(new Set()), []);

  const run = useCallback(
    async (action: Parameters<typeof bulkItems>[1]) => {
      const targets = [...ids];
      if (!targets.length) return;
      setBusy(true);
      try {
        await bulkItems(targets, action);
        setIds(new Set());
        await onDone();
      } finally {
        setBusy(false);
      }
    },
    [ids, onDone],
  );

  const actions = useMemo(
    () => ({
      setPillar: (pillarId: string | null) =>
        run({ action: "pillar", pillarId }),
      move: (stage: ContentStage) => run({ action: "stage", stage }),
      setStatus: (status: ContentStatus) => run({ action: "status", status }),
      remove: () => run({ action: "delete" }),
    }),
    [run],
  );

  return { ids, count: ids.size, busy, toggle, selectAll, clear, actions };
}
