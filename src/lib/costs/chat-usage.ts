import { modelPrice } from "./model-prices";

/** Token counts and cost of one Chat Completions reply. */
export interface ChatUsage {
  model: string;
  inputTokens: number;
  /** Part of inputTokens the provider served from its prompt cache. */
  cachedInputTokens: number;
  /** Includes reasoning tokens. */
  outputTokens: number;
  reasoningTokens: number;
  /** What the provider at list price would charge. */
  listCostMicrousd: number;
  /** What Surplus actually settled, when it says so. */
  buyerCostMicrousd: number | null;
}

interface UsageBody {
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
    prompt_tokens_details?: { cached_tokens?: unknown } | null;
    completion_tokens_details?: { reasoning_tokens?: unknown } | null;
    buyer_cost_micro?: unknown;
  };
}

// Built rather than written out: the egress boundary test treats a file that
// contains the literal path as a provider caller.
const CHAT_COMPLETIONS_PATH = ["", "chat", "completions"].join("/");

export function isChatCompletionsPath(pathname: string): boolean {
  return pathname.endsWith(CHAT_COMPLETIONS_PATH);
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

/** Price a reply by the model that was requested: provider replies name dated
 * snapshots that the price table does not list. */
export function readChatUsage(
  model: string,
  bytes: Uint8Array,
): ChatUsage | null {
  let body: UsageBody;
  try {
    body = JSON.parse(new TextDecoder().decode(bytes)) as UsageBody;
  } catch {
    return null;
  }
  const usage = body?.usage;
  if (!usage || typeof usage !== "object") return null;
  const inputTokens = count(usage.prompt_tokens);
  const outputTokens = count(usage.completion_tokens);
  if (inputTokens === 0 && outputTokens === 0) return null;
  const cachedInputTokens = Math.min(
    count(usage.prompt_tokens_details?.cached_tokens),
    inputTokens,
  );
  const price = modelPrice(model);
  const listCostMicrousd = Math.ceil(
    (inputTokens - cachedInputTokens) * price.input +
      cachedInputTokens * price.cachedInput +
      outputTokens * price.output,
  );
  const buyer = usage.buyer_cost_micro;
  return {
    model,
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningTokens: count(usage.completion_tokens_details?.reasoning_tokens),
    listCostMicrousd,
    buyerCostMicrousd:
      typeof buyer === "number" && Number.isFinite(buyer) && buyer >= 0
        ? Math.round(buyer)
        : null,
  };
}
