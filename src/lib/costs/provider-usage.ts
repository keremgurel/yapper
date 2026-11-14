import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { captureServerEvent } from "@/lib/analytics/server";
import {
  settleProviderBudget,
  type ProviderReservation,
} from "./provider-budget";
import { isChatCompletionsPath, readChatUsage } from "./chat-usage";
import { readAudioUsage } from "./audio-usage";
import { currentAiUsage, type AiCall } from "./ai-usage-scope";
import { aiGenerationProperties } from "./ai-usage-events";

export interface ProviderResponse {
  input: RequestInfo | URL;
  init: RequestInit;
  reservation: ProviderReservation;
  status: number;
  bytes: Uint8Array;
  latencyMs: number;
}

function chatCompletionsModel(url: URL, init: RequestInit): string | null {
  if (!isChatCompletionsPath(url.pathname)) return null;
  if (typeof init.body !== "string") return null;
  try {
    const model = (JSON.parse(init.body) as { model?: unknown }).model;
    return typeof model === "string" ? model : null;
  } catch {
    return null;
  }
}

async function distinctIdOutsideScope(): Promise<string> {
  try {
    return (await auth()).userId ?? "server";
  } catch {
    return "server";
  }
}

/** A transcription reply in the shape a model call is recorded in. These
 * providers are paid directly, so what was settled is the list price. */
function transcriptionCall(url: URL, reply: ProviderResponse) {
  const audio = readAudioUsage(url, reply.init, reply.bytes);
  if (!audio) return null;
  return {
    ...audio,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    buyerCostMicrousd: audio.listCostMicrousd,
  };
}

function report(call: AiCall): void {
  const scope = currentAiUsage();
  if (scope && !scope.reported) {
    scope.calls.push(call);
    return;
  }
  const send = async () =>
    captureServerEvent(
      scope?.distinctId ?? (await distinctIdOutsideScope()),
      "$ai_generation",
      {
        ...scope?.properties,
        ...aiGenerationProperties(call, scope?.action ?? "unattributed"),
      },
    );
  try {
    after(send);
  } catch {
    void send();
  }
}

/**
 * Account for one successful paid reply: settle its budget reservation down to
 * list cost and report what it used. Chat Completions report tokens and the
 * transcribers report audio length; any other provider keeps its fixed
 * reservation. Never throws, so accounting can never fail a product request.
 */
export async function recordProviderResponse(
  reply: ProviderResponse,
): Promise<void> {
  try {
    if (reply.status < 200 || reply.status >= 300) return;
    const url = new URL(
      reply.input instanceof Request ? reply.input.url : String(reply.input),
    );
    const model = chatCompletionsModel(url, reply.init);
    const usage = model
      ? readChatUsage(model, reply.bytes)
      : transcriptionCall(url, reply);
    if (!usage) return;
    await settleProviderBudget(reply.reservation, usage.listCostMicrousd);
    report({
      ...usage,
      provider: url.hostname,
      status: reply.status,
      latencyMs: Math.round(reply.latencyMs),
    });
  } catch {
    console.warn("[costs] provider usage not recorded");
  }
}
