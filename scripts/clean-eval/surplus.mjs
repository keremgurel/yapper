/** Thin Surplus client: one completion with timing, usage, and request id. */

const BASE = (
  process.env.SURPLUS_API_BASE ?? "https://api.surplusintelligence.ai/v1"
).replace(/\/$/, "");

function key() {
  const value = process.env.SURPLUS_API_KEY;
  if (!value) throw new Error("SURPLUS_API_KEY is required");
  return value;
}

let catalogPromise;
/** Model id -> { prompt, completion } USD per token, plus supported params. */
export function catalog() {
  catalogPromise ??= fetch(`${BASE}/models`, {
    headers: { Authorization: `Bearer ${key()}` },
  })
    .then((r) => r.json())
    .then((json) => {
      const map = new Map();
      for (const m of json.data ?? []) {
        map.set(m.id, {
          prompt: Number(m.pricing?.prompt ?? 0),
          completion: Number(m.pricing?.completion ?? 0),
          params: new Set(m.supported_parameters ?? []),
        });
      }
      return map;
    });
  return catalogPromise;
}

export async function complete(body, { timeoutMs = 320_000 } = {}) {
  const started = performance.now();
  const response = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const elapsedMs = Math.round(performance.now() - started);
  const data = await response.json().catch(() => ({}));
  return {
    status: response.status,
    requestId: response.headers.get("x-request-id"),
    adaptedParams: response.headers.get("x-si-adapted-params"),
    elapsedMs,
    answer: data.choices?.[0]?.message?.content ?? "",
    finishReason: data.choices?.[0]?.finish_reason ?? null,
    usage: data.usage ?? null,
    error: data.error ?? null,
  };
}

export function listCost(usage, price) {
  if (!usage || !price) return null;
  const inTokens = usage.prompt_tokens ?? 0;
  const outTokens = usage.completion_tokens ?? 0;
  return Number(
    (inTokens * price.prompt + outTokens * price.completion).toFixed(6),
  );
}

/** Settled cost per request id from the account's recent usage window. */
export async function settledByRequestId() {
  const response = await fetch(`${BASE}/buyer/me`, {
    headers: { Authorization: `Bearer ${key()}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return new Map();
  const json = await response.json();
  const map = new Map();
  for (const row of json.recent_usage ?? []) {
    map.set(row.id, {
      settledUsd: Number(row.buyer_cost_usdc) / 1e6,
      directUsd: Number(row.direct_cost_usdc) / 1e6,
      status: row.settlement_status,
    });
  }
  return map;
}
