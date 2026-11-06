"use client";

import { useRef, useState } from "react";
import type { BrainUsed } from "@/lib/brain/context/types";
import {
  blocksForRequest,
  parseCanvasActions,
  type CanvasAction,
} from "@/lib/content/canvas-actions";
import type { CanvasBlock } from "@/lib/content/canvas-doc";
import type { ContentBase } from "@/lib/content/rebase";
import { baseOf } from "@/lib/content/save-base";

export type CanvasAskError =
  | "locked"
  | "insufficient"
  | "failed"
  | "limited"
  /** The creator saved an edit while the writer worked; nothing was saved
   * or charged. */
  | "changed";

export interface CanvasAskContext {
  title: string;
  blocks: CanvasBlock[];
  hooks: string[];
  originalNote?: string;
  source?: {
    title?: string | null;
    url?: string | null;
    excerpt?: string | null;
  };
}

export interface CanvasAskReply {
  actions: CanvasAction[];
  note: string | null;
  used: BrainUsed | null;
  /** The exchange as the server saved it to the idea's thread, when it did. */
  messages: unknown[] | null;
  /** The lead as the server saved it, the base of the next autosave. */
  document: ContentBase | null;
}

function readUsed(data: Record<string, unknown>): BrainUsed | null {
  const used = data.used as Partial<BrainUsed> | undefined;
  if (!used) return null;
  const names = (value: unknown) =>
    Array.isArray(value)
      ? value.filter((name): name is string => typeof name === "string")
      : [];
  const skills = names(used.skills);
  const context = names(used.context);
  return skills.length || context.length ? { skills, context } : null;
}

/**
 * One ask at a time against the canvas route, which edits and saves the
 * idea's stored document itself (`serverSaves`). The reply's actions are
 * parsed against the block count the request was made with, so the caller
 * can apply the same edit to what it shows.
 */
export function useCanvasAsk() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CanvasAskError | null>(null);
  const inFlight = useRef(false);

  const ask = async (
    instruction: string,
    context: CanvasAskContext,
    target: number | null,
    contentId: string | null = null,
  ): Promise<CanvasAskReply | { failed: CanvasAskError } | null> => {
    if (inFlight.current || !instruction.trim()) return null;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/generate/canvas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction: instruction.trim(),
          title: context.title,
          blocks: blocksForRequest(context.blocks),
          hooks: context.hooks.slice(0, 8),
          originalNote: context.originalNote,
          source: context.source,
          target,
          contentId,
          serverSaves: true,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        const failed: CanvasAskError =
          data.error === "not_entitled"
            ? "locked"
            : data.error === "changed_while_working"
              ? "changed"
              : res.status === 402
                ? "insufficient"
                : res.status === 429
                  ? "limited"
                  : "failed";
        setError(failed);
        return { failed };
      }
      return {
        actions: parseCanvasActions(data, context.blocks.length),
        note: typeof data.note === "string" ? data.note : null,
        used: readUsed(data),
        messages: Array.isArray(data.messages) ? data.messages : null,
        document:
          data.document && typeof data.document === "object"
            ? baseOf(data.document as Parameters<typeof baseOf>[0])
            : null,
      };
    } catch {
      setError("failed");
      return { failed: "failed" };
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return { ask, busy, error, clearError: () => setError(null) };
}
