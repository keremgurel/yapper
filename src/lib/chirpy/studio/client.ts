import type { StudioDecision } from "./typed-decision";
import type { StudioTurnReply } from "./wire";

/** Why a Studio turn did not run, in words for the Chirpy panel. */
export class StudioTurnError extends Error {}

const FAILURES: Record<string, string> = {
  insufficient_credits:
    "You’re out of credits for Chirpy. Top up in Billing, then try again.",
  not_entitled: "Chirpy actions need a plan with AI credits.",
  rate_limited: "That’s a lot of requests at once. Give it a minute.",
  expired:
    "That confirmation expired, so nothing changed. Ask me again if you still want it.",
};

async function post(path: string, body: unknown): Promise<StudioTurnReply> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as
    | StudioTurnReply
    | { error?: string };
  if (!response.ok) {
    const code =
      response.status === 429
        ? "rate_limited"
        : "error" in data && data.error
          ? data.error
          : "";
    throw new StudioTurnError(
      FAILURES[code] ??
        "I couldn’t reach Studio just now. Nothing was charged. Try again.",
    );
  }
  return data as StudioTurnReply;
}

function timeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Plan and run one Studio turn. The execution ID makes a retry safe. */
export function sendStudioTurn(turn: {
  surface: string;
  messages: { role: "user" | "assistant"; content: string }[];
  focusIdeaID?: string;
}): Promise<StudioTurnReply> {
  return post("/api/chirpy/studio", {
    protocolVersion: 1,
    executionID: crypto.randomUUID(),
    surface: turn.surface,
    timeZone: timeZone(),
    ...(turn.focusIdeaID ? { focus: { ideaID: turn.focusIdeaID } } : {}),
    messages: turn.messages,
  });
}

/** Answer a turn's confirmation. Runs no model and spends no credit. */
export function answerStudioConfirmation(
  executionID: string,
  decision: StudioDecision,
): Promise<StudioTurnReply> {
  return post("/api/chirpy/confirm", {
    executionID,
    decision,
    timeZone: timeZone(),
  });
}
