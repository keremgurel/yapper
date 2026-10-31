"use client";

import { useCallback } from "react";
import {
  answerStudioConfirmation,
  sendStudioTurn,
  StudioTurnError,
} from "@/lib/chirpy/studio/client";
import { applyStudioEffects } from "@/lib/chirpy/studio/effects-client";
import type { StudioEffect, StudioTurnReply } from "@/lib/chirpy/studio/wire";
import type {
  ChirpyConfirmation,
  ChirpyMessage,
} from "@/components/studio-shell/chirpy-message";

/** A reply for the panel, plus what the server changed for the Mac to
 * reload in its own stores. */
type Reply = Omit<ChirpyMessage, "id" | "author"> & {
  effects?: StudioEffect[];
};

const UUID_IN_PATH =
  /\/studio\/(?:ideas|library)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function messageFrom(reply: StudioTurnReply): Reply {
  return {
    text: reply.message,
    notes: reply.notes,
    tone: reply.tone === "answer" ? undefined : reply.tone,
    effects: reply.effects,
    ...(reply.confirm
      ? {
          confirm: {
            executionID: reply.confirm.executionID,
            question: reply.confirm.question,
            confirmLabel: reply.confirm.confirmLabel,
            state: "open" as const,
          },
        }
      : {}),
  };
}

function trouble(cause: unknown): Reply {
  return {
    text:
      cause instanceof StudioTurnError
        ? cause.message
        : "I couldn’t reach Studio just now. Nothing was charged. Try again.",
    tone: "trouble",
  };
}

/**
 * Chirpy's Studio actions from the panel: a turn plans and runs them on the
 * server, and a confirmation answers the ones that ask first. Both reload
 * whatever the server changed.
 */
export function useStudioTurn(
  setConfirmState: (
    executionID: string,
    state: ChirpyConfirmation["state"],
  ) => void,
) {
  const ask = useCallback(
    async (
      text: string,
      surface: string,
      history: { role: "user" | "assistant"; content: string }[],
    ): Promise<Reply> => {
      try {
        const reply = await sendStudioTurn({
          surface: surface.split("?")[0].replace(/\/$/, "") || "/studio",
          messages: [...history.slice(-19), { role: "user", content: text }],
          focusIdeaID: UUID_IN_PATH.exec(surface)?.[1],
        });
        applyStudioEffects(reply.effects);
        return messageFrom(reply);
      } catch (cause) {
        return trouble(cause);
      }
    },
    [],
  );

  const answer = useCallback(
    async (
      executionID: string,
      decision: "confirm" | "cancel",
    ): Promise<Reply> => {
      setConfirmState(executionID, "working");
      try {
        const reply = await answerStudioConfirmation(executionID, decision);
        applyStudioEffects(reply.effects);
        setConfirmState(
          executionID,
          decision === "confirm" ? "confirmed" : "canceled",
        );
        return messageFrom(reply);
      } catch (cause) {
        setConfirmState(executionID, "open");
        return trouble(cause);
      }
    },
    [setConfirmState],
  );

  return { ask, answer };
}
