"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  docFromItem,
  patchFromDoc,
  type CanvasBlock,
} from "@/lib/content/canvas-doc";
import type { ContentDetail, ContentPatch } from "@/lib/content/client";

/**
 * The canvas document for one item, and the one way it is written back.
 *
 * Blocks live here with client ids so reorders keep focus; every change is
 * turned into the persisted shape (blocks plus the mirrored script) and
 * handed to the item's autosave queue. Hooks stay on the item, because the
 * recorder and the poster read them from there, and are edited as plain text.
 */
const NO_BLOCKS: CanvasBlock[] = [];

export function useCanvasDoc(
  item: ContentDetail | null,
  update: (patch: ContentPatch) => void,
) {
  // Derived on first sight of each item, during render rather than in an
  // effect, so the first paint already has the blocks and nothing flashes.
  const [state, setState] = useState<{
    id: string | null;
    blocks: CanvasBlock[];
  }>({
    id: null,
    blocks: [],
  });
  if (item && state.id !== item.id) {
    setState({ id: item.id, blocks: docFromItem(item) });
  }
  const blocks = useMemo(
    () => (item && state.id === item.id ? state.blocks : NO_BLOCKS),
    [item, state],
  );
  // The newest blocks, readable from a callback without waiting for a render,
  // so the save happens outside the state updater (which React may run twice).
  const latest = useRef(blocks);
  useEffect(() => {
    latest.current = blocks;
  }, [blocks]);
  const itemId = item?.id ?? null;

  const setBlocks = useCallback(
    (next: CanvasBlock[] | ((current: CanvasBlock[]) => CanvasBlock[])) => {
      const resolved = typeof next === "function" ? next(latest.current) : next;
      latest.current = resolved;
      setState({ id: itemId, blocks: resolved });
      update(patchFromDoc(resolved));
    },
    [itemId, update],
  );

  const hooks = (item?.hooks ?? []).map((hook) => hook.text);
  const setHooks = useCallback(
    (texts: string[]) => update({ hooks: texts }),
    [update],
  );

  return { blocks, setBlocks, hooks, setHooks };
}
