"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutosave, type SaveState } from "@/hooks/use-autosave";
import {
  createBlock,
  deleteBlock,
  listBlocks,
  patchBlock,
  reorderBlocks,
  type BrainBlock,
  type BrainBlockPatch,
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
  saveState: SaveState;
  edit: (id: string, patch: BrainBlockPatch) => void;
  add: (block: BrainBlockPatch & { title: string }) => Promise<BrainBlock>;
  remove: (id: string) => Promise<void>;
  move: (id: string, direction: -1 | 1) => Promise<void>;
} {
  const [blocks, setBlocks] = useState<BrainBlock[] | null>(null);

  useEffect(() => {
    let active = true;
    listBlocks().then(
      (loaded) => {
        if (active) setBlocks(loaded);
      },
      () => {
        // An empty page the creator can still write into beats an error they
        // can do nothing about; the next save reports the real failure.
        if (active) setBlocks([]);
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
  const { state: saveState, queue } =
    useAutosave<Record<string, BrainBlockPatch>>(save);

  const edit = useCallback(
    (id: string, patch: BrainBlockPatch) => {
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
    async (input: BrainBlockPatch & { title: string }) => {
      const block = await createBlock(input);
      setBlocks((prev) => [...(prev ?? []), block]);
      return block;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    setBlocks((prev) => prev?.filter((block) => block.id !== id) ?? prev);
    await deleteBlock(id);
  }, []);

  const move = useCallback(
    async (id: string, direction: -1 | 1) => {
      const current = blocks ?? [];
      const from = current.findIndex((block) => block.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= current.length) return;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setBlocks(next);
      setBlocks(await reorderBlocks(next.map((block) => block.id)));
    },
    [blocks],
  );

  return {
    blocks: blocks ?? [],
    loading: blocks === null,
    saveState,
    edit,
    add,
    remove,
    move,
  };
}
