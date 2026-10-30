import type { AiCall } from "./ai-usage-scope";

/** PostHog LLM analytics properties for one call. Never prompt or reply text. */
export function aiGenerationProperties(
  call: AiCall,
  action: string,
): Record<string, unknown> {
  return {
    action,
    $ai_provider: call.provider,
    $ai_model: call.model,
    $ai_http_status: call.status,
    $ai_latency: call.latencyMs / 1000,
    $ai_input_tokens: call.inputTokens,
    $ai_cache_read_input_tokens: call.cachedInputTokens,
    $ai_output_tokens: call.outputTokens,
    ai_reasoning_tokens: call.reasoningTokens,
    $ai_total_cost_usd: call.listCostMicrousd / 1_000_000,
    ai_list_cost_microusd: call.listCostMicrousd,
    ai_buyer_cost_microusd: call.buyerCostMicrousd,
  };
}

/** Totals for a product action, added to its completed/failed event. */
export function aiUsageSummary(calls: readonly AiCall[]) {
  let buyer: number | null = calls.length ? 0 : null;
  const totals = {
    ai_calls: calls.length,
    ai_input_tokens: 0,
    ai_cached_input_tokens: 0,
    ai_output_tokens: 0,
    ai_reasoning_tokens: 0,
    ai_list_cost_microusd: 0,
  };
  for (const call of calls) {
    totals.ai_input_tokens += call.inputTokens;
    totals.ai_cached_input_tokens += call.cachedInputTokens;
    totals.ai_output_tokens += call.outputTokens;
    totals.ai_reasoning_tokens += call.reasoningTokens;
    totals.ai_list_cost_microusd += call.listCostMicrousd;
    buyer =
      buyer === null || call.buyerCostMicrousd === null
        ? null
        : buyer + call.buyerCostMicrousd;
  }
  return { ...totals, ai_buyer_cost_microusd: buyer };
}
