import { fetchBoundedJson, OutboundHttpError } from "@/lib/http/outbound";

/**
 * The one place the overlay routes call Chat Completions.
 *
 * Same discipline as the other passes: bounded response, the inbound request's
 * signal so a disconnect stops provider work, a token cap, temperature 0, and
 * JSON mode. Two attempts, and only when the model was busy rather than wrong.
 * A cut-off answer fails closed: half a scene validates as a worse scene, not
 * as an error, so `finish_reason` "length" is thrown rather than parsed.
 *
 * No `reasoning` parameter is sent: Google rejects it with a 400 through the
 * gateway, and the reasoning models here decide their own budget.
 */
export interface SceneModelCall {
  model: string;
  system: string;
  user: string;
  maxCompletionTokens: number;
  /** Wall clock for every attempt together. */
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface SceneModelReply {
  content: string;
  finishReason?: string;
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string }; finish_reason?: string }[];
  /** The gateway answers 200 and puts the provider's failure in the body. */
  error?: { code?: number; message?: string };
}

const MAX_PROVIDER_RESPONSE_BYTES = 2 * 1024 * 1024;
const ATTEMPTS = 2;
const RETRY_PAUSE_MS = 1_000;

function isTransient(error: { code?: number } | undefined, answer: string) {
  if (!answer.trim()) return true;
  const code = error?.code;
  return code === 429 || code === 500 || code === 502 || code === 503;
}

function isRetryableProviderFailure(error: unknown): boolean {
  if (error instanceof OutboundHttpError) {
    return error.code === "network_error" || error.code === "invalid_response";
  }
  return error instanceof Error && /^ai_(429|5\d\d)$/.test(error.message);
}

/** The short reason a route or reply reports for a failed call. */
export function sceneModelFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "answer_truncated" || message === "timeout") return message;
  if (message === "layout_quality_failed") return message;
  if (message === "aborted") return "timeout";
  if (/^ai_\d{3}$/.test(message)) return message;
  return "ai_failed";
}

export async function callSceneModel(
  call: SceneModelCall,
): Promise<SceneModelReply> {
  const key = process.env.SURPLUS_API_KEY;
  if (!key) throw new Error("no_provider");
  const base =
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1";
  const deadline = Date.now() + call.timeoutMs;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const last = attempt === ATTEMPTS - 1;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");
    try {
      const { response, data } = await fetchBoundedJson<ChatCompletionResponse>(
        `${base}/chat/completions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: call.model,
            temperature: 0,
            max_completion_tokens: call.maxCompletionTokens,
            // The gateway forwards Claude requests without translating this
            // OpenAI-only option. The prompt + parser still require JSON.
            ...(!call.model.startsWith("claude-")
              ? { response_format: { type: "json_object" } }
              : {}),
            messages: [
              { role: "system", content: call.system },
              { role: "user", content: call.user },
            ],
          }),
        },
        {
          timeoutMs: remaining,
          maxBytes: MAX_PROVIDER_RESPONSE_BYTES,
          signal: call.signal,
        },
      );
      if (!response.ok) throw new Error(`ai_${response.status}`);
      const choice = data.choices?.[0];
      if (choice?.finish_reason === "length") {
        throw new Error("answer_truncated");
      }
      const content = choice?.message?.content ?? "";
      if (content.trim() && !data.error) {
        return { content, finishReason: choice?.finish_reason };
      }
      if (last || !isTransient(data.error, content)) {
        throw new Error(
          data.error?.code ? `ai_${data.error.code}` : "empty_answer",
        );
      }
    } catch (error) {
      if (
        last ||
        !isRetryableProviderFailure(error) ||
        deadline - Date.now() <= RETRY_PAUSE_MS
      ) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, RETRY_PAUSE_MS));
  }
  throw new Error("empty_answer");
}
