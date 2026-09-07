"use client";

import { useCallback, useEffect, useState } from "react";
import type { CanvasAction } from "@/lib/content/canvas-actions";

export interface CanvasMessage {
  id: string;
  role: "creator" | "chirpy";
  text: string;
  actions: CanvasAction[];
  createdAt: string;
  /** Set on a reply the client has not yet had confirmed by the server. */
  pending?: boolean;
}

function parseMessage(value: unknown): CanvasMessage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.text !== "string") return null;
  return {
    id: raw.id,
    role: raw.role === "chirpy" ? "chirpy" : "creator",
    text: raw.text,
    actions: Array.isArray(raw.actions) ? (raw.actions as CanvasAction[]) : [],
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
  };
}

/**
 * The conversation on one idea.
 *
 * Loaded once per item; the canvas route persists each exchange and returns
 * the saved rows, which replace the optimistic pair the page showed while the
 * reply was in flight. Clearing starts the thread over without touching the
 * canvas.
 */
export function useCanvasThread(contentId: string | null) {
  const [messages, setMessages] = useState<CanvasMessage[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!contentId) return;
    let active = true;
    fetch(`/api/content/${contentId}/messages`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`thread_${res.status}`);
        const data = (await res.json()) as { messages?: unknown[] };
        const parsed = (data.messages ?? [])
          .map(parseMessage)
          .filter((m): m is CanvasMessage => m !== null);
        if (active) {
          setMessages(parsed);
          setLoadedFor(contentId);
          setFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setLoadedFor(contentId);
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [contentId]);

  /** Shows the ask immediately, before the reply lands. */
  const pendingAsk = useCallback((text: string) => {
    const id = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      {
        id,
        role: "creator",
        text,
        actions: [],
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);
    return id;
  }, []);

  /** Replaces the pending ask with what the server saved, or drops it. */
  const settle = useCallback((pendingId: string, saved: unknown[] | null) => {
    setMessages((current) => {
      const without = current.filter((m) => m.id !== pendingId);
      if (!saved) return without;
      const parsed = saved
        .map(parseMessage)
        .filter((m): m is CanvasMessage => m !== null);
      return [...without, ...parsed];
    });
  }, []);

  const clear = useCallback(async () => {
    if (!contentId) return;
    const previous = messages;
    setMessages([]);
    try {
      const res = await fetch(`/api/content/${contentId}/messages`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("clear_failed");
    } catch {
      setMessages(previous);
    }
  }, [contentId, messages]);

  return {
    messages,
    loading: contentId !== null && loadedFor !== contentId,
    failed,
    pendingAsk,
    settle,
    clear,
  };
}
