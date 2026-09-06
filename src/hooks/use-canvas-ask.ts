"use client";

import { useRef, useState } from "react";
import type { BrainUsed } from "@/lib/brain/context/types";
import {
  blocksForRequest,
  parseCanvasActions,
  type CanvasAction,
} from "@/lib/content/canvas-actions";
import type { CanvasBlock } from "@/lib/content/canvas-doc";

export type CanvasAskError = "locked" | "insufficient" | "failed" | "limited";

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
 * One ask at a time against the canvas route. The reply's actions are parsed
 * against the block count the request was made with, so a slow reply cannot
 * land on a document that changed shape while it was in flight; the caller
 * decides whether to apply them.
 */
export function useCanvasAsk() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CanvasAskError | null>(null);
  const inFlight = useRef(false);

  const ask = async (
    instruction: string,
    context: CanvasAskContext,
    target: number | null,
  ): Promise<CanvasAskReply | null> => {
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
        }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      if (!res.ok) {
        setError(
          data.error === "not_entitled"
            ? "locked"
            : res.status === 402
              ? "insufficient"
              : res.status === 429
                ? "limited"
                : "failed",
        );
        return null;
      }
      return {
        actions: parseCanvasActions(data, context.blocks.length),
        note: typeof data.note === "string" ? data.note : null,
        used: readUsed(data),
      };
    } catch {
      setError("failed");
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return { ask, busy, error, clearError: () => setError(null) };
}
