"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mergeRecordPatches } from "@/lib/save-queue";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import {
  createBlock,
  deleteBlock,
  listBlocks,
  patchBlock,
  reorderBlocks,
  type BrainBlock,
  type BrainBlockPatch,
  type NewBrainBlock,
} from "@/lib/brain/client";

/**
 * The creator's own sections of the brain.
 *
 * Edits are applied locally first and autosaved per block, because a block is
 * the unit the creator thinks in: typing in one must never be gated on a save
 * in another, and a slow PATCH on the hooks list must never land after and
 * overwrite the goal they typed afterwards.
 */
export function useBrainBlocks(): {
  blocks: BrainBlock[];
  loading: boolean;
  available: boolean;
  saveState: SaveState;
  error: string | null;
  refresh: () => Promise<void>;
  retry: () => Promise<void>;
  editAndSave: (id: string, patch: BrainBlockPatch) => Promise<void>;
  edit: (id: string, patch: BrainBlockPatch) => void;
  add: (block: NewBrainBlock) => Promise<BrainBlock>;
  remove: (id: string) => Promise<void>;
  move: (id: string, direction: -1 | 1) => Promise<void>;
  reorder: (ids: string[]) => Promise<void>;
} {
  const [blocks, setBlocks] = useState<BrainBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const revision = useRef(0);
  const deleting = useRef(new Set<string>());
  const ordering = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    listBlocks().then(
      (loaded) => {
        if (active) {
          setBlocks(loaded);
          setLoaded(true);
          setError(null);
        }
      },
      () => {
        if (active) {
          setError("Your Knowledge couldn’t be loaded. Try again.");
          setLoaded(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(
    async (
      dirty: Partial<Record<string, BrainBlockPatch>>,
      opts?: { keepalive?: boolean },
    ) => {
      for (const [id, patch] of Object.entries(dirty)) {
        if (patch) await patchBlock(id, patch, opts);
      }
    },
    [],
  );
  const {
    state: saveState,
    queue,
    flush,
  } = useAutosave<Record<string, BrainBlockPatch>>(
    save,
    800,
    mergeRecordPatches,
  );

  const refresh = useCallback(async () => {
    try {
      await flush();
      const started = revision.current;
      const result = await listBlocks();
      if (started === revision.current) setBlocks(result);
      setError(null);
    } catch {
      setError("Your Knowledge couldn’t be loaded. Try again.");
    } finally {
      setLoaded(true);
    }
  }, [flush]);

  const edit = useCallback(
    (id: string, patch: BrainBlockPatch) => {
      if (deleting.current.has(id)) return;
      revision.current++;
      setBlocks((prev) =>
        prev
          ? prev.map((block) =>
              block.id === id ? { ...block, ...patch } : block,
            )
          : prev,
      );
      // Merged by id, so two edits to the same block collapse into one PATCH
      // and edits to different blocks stay separate requests.
      queue({ [id]: patch });
    },
    [queue],
  );

  const add = useCallback(
    async (input: NewBrainBlock) => {
      if (blocks === null) throw new Error("knowledge_not_loaded");
      try {
        const block = await createBlock(input);
        revision.current++;
        setBlocks((prev) => [...(prev ?? []), block]);
        setError(null);
        return block;
      } catch (cause) {
        setError("That Knowledge couldn’t be added. Try again.");
        throw cause;
      }
    },
    [blocks],
  );

  const remove = useCallback(
    async (id: string) => {
      if (deleting.current.has(id)) return;
      deleting.current.add(id);
      try {
        await flush();
        await deleteBlock(id);
        revision.current++;
        setBlocks((prev) => prev?.filter((block) => block.id !== id) ?? prev);
        setError(null);
      } catch (cause) {
        setError(
          "That memory couldn’t be removed. Your Knowledge is still here.",
        );
        throw cause;
      } finally {
        deleting.current.delete(id);
      }
    },
    [flush],
  );

  const editAndSave = useCallback(
    async (id: string, patch: BrainBlockPatch) => {
      if (deleting.current.has(id)) throw new Error("knowledge_removing");
      edit(id, patch);
      await flush();
    },
    [edit, flush],
  );

  const reorder = useCallback(
    (ids: string[]) => {
      const run = ordering.current.then(async () => {
        try {
          await flush();
          const saved = await reorderBlocks(ids);
          revision.current++;
          // Reordering changes order, not text that may be edited meanwhile.
          setBlocks((previous) => {
            const byId = new Map(previous?.map((block) => [block.id, block]));
            const ordered = saved.map((block) => ({
              ...(byId.get(block.id) ?? block),
              sortOrder: block.sortOrder,
            }));
            const known = new Set(saved.map((block) => block.id));
            return [
              ...ordered,
              ...(previous ?? []).filter((block) => !known.has(block.id)),
            ];
          });
          setError(null);
        } catch (cause) {
          setError(
            "The new order couldn’t be saved. Drag the memory again to retry.",
          );
          throw cause;
        }
      });
      ordering.current = run.catch(() => {});
      return run;
    },
    [flush],
  );

  const move = useCallback(
    async (id: string, direction: -1 | 1) => {
      const current = blocks ?? [];
      const from = current.findIndex((block) => block.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      await reorder(next.map((block) => block.id));
    },
    [blocks, reorder],
  );

  return {
    blocks: blocks ?? [],
    loading: !loaded,
    available: blocks !== null,
    error,
    refresh,
    retry: flush,
    editAndSave,
    saveState,
    edit,
    add,
    remove,
    move,
    reorder,
  };
}
