/** Thin Surplus client for the eval and the probes: catalog prices and one raw call. */

/** Read lazily: .env.local is loaded after the imports run. */
export function base() {
  return (
    process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1"
  ).replace(/\/$/, "");
}

function key() {
  const value = process.env.SURPLUS_API_KEY;
  if (!value) throw new Error("SURPLUS_API_KEY is required");
  return value;
}

let catalogPromise;
/** Model id -> list USD per token (input, cached input, output) and params. */
export function catalog() {
  catalogPromise ??= fetch(`${base()}/models`, {
    headers: { Authorization: `Bearer ${key()}` },
  })
    .then((r) => r.json())
    .then((json) => {
      const map = new Map();
      for (const m of json.data ?? []) {
        const prompt = Number(m.pricing?.prompt ?? 0);
        map.set(m.id, {
          prompt,
          cacheRead: Number(m.pricing?.input_cache_read ?? prompt),
          completion: Number(m.pricing?.completion ?? 0),
          params: new Set(m.supported_parameters ?? []),
        });
      }
      return map;
    });
  return catalogPromise;
}

/**
 * List price of one reply's usage. Cached input bills at the catalog's cache
 * read rate; reasoning tokens are already inside completion_tokens.
 */
export function listCostUsd(usage, price) {
  if (!usage || !price) return null;
  const input = usage.prompt_tokens ?? 0;
  const cached = Math.min(
    input,
    usage.prompt_tokens_details?.cached_tokens ?? 0,
  );
  const output = usage.completion_tokens ?? 0;
  return (
    (input - cached) * price.prompt +
    cached * price.cacheRead +
    output * price.completion
  );
}

/** The x-si-* headers that explain routing and caching for one reply. */
export function routingHeaders(headers) {
  const keep = [
    "x-request-id",
    "x-si-provider-family",
    "x-si-served-by",
    "x-si-cache-mode",
    "x-si-cache-warm",
    "x-si-cache-served-by-warm",
    "x-si-adapted-params",
    "x-si-buyer-cost-micro",
  ];
  return Object.fromEntries(
    keep.map((name) => [name, headers.get(name)]).filter(([, v]) => v != null),
  );
}

/** One chat completion with timing, usage and routing headers, for the probes. */
export async function complete(body, { timeoutMs = 120_000 } = {}) {
  const started = performance.now();
  const response = await fetch(`${base()}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = await response.json().catch(() => ({}));
  const choice = data.choices?.[0];
  return {
    status: response.status,
    elapsedMs: Math.round(performance.now() - started),
    headers: routingHeaders(response.headers),
    content: choice?.message?.content ?? "",
    toolCalls: choice?.message?.tool_calls ?? [],
    finishReason: choice?.finish_reason ?? null,
    usage: data.usage ?? null,
    error: data.error ?? null,
  };
}

/** The usage numbers a probe or report cares about, flattened. */
export function usageSummary(usage) {
  return {
    prompt: usage?.prompt_tokens ?? 0,
    cached: usage?.prompt_tokens_details?.cached_tokens ?? 0,
    output: usage?.completion_tokens ?? 0,
    reasoning: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
    settledMicro: usage?.buyer_cost_micro ?? null,
  };
}
