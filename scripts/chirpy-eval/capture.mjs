import { AsyncLocalStorage } from "node:async_hooks";
import { base, routingHeaders } from "./surplus.mjs";

const turns = new AsyncLocalStorage();

/**
 * Wrap global fetch so every provider call made inside `withTurn` is
 * recorded with its request shape, usage, routing headers and timing. The
 * planner and its helpers are untouched: whatever request layout they build
 * is what gets measured, including changes other sessions land.
 *
 * A turn's variant may rewrite the outgoing body (for example to set
 * reasoning_effort). Any host other than Surplus is refused, so an eval run
 * cannot reach analytics or another shared service by accident.
 */
export function installFetchCapture() {
  const realFetch = globalThis.fetch;
  const surplusHost = new URL(base()).host;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const turn = turns.getStore();
    if (!turn) return realFetch(input, init);
    if (url.host !== surplusHost) {
      turn.blocked.push(url.host);
      throw new Error(`eval_blocked_egress:${url.host}`);
    }
    const call = { path: url.pathname };
    let body = init.body;
    if (
      typeof body === "string" &&
      url.pathname.endsWith("/chat/completions")
    ) {
      const json = JSON.parse(body);
      call.rewritten = turn.variant?.rewrite?.(json) ?? [];
      call.request = describeRequest(json);
      if (turn.keepBodies) call.body = json;
      body = JSON.stringify(json);
      call.requestBytes = Buffer.byteLength(body);
    }
    const started = performance.now();
    turn.calls.push(call);
    let response;
    try {
      response = await realFetch(input, { ...init, body });
    } catch (error) {
      call.networkError = error.message;
      call.elapsedMs = Math.round(performance.now() - started);
      throw error;
    }
    call.status = response.status;
    call.headers = routingHeaders(response.headers);
    call.done = response
      .clone()
      .json()
      .then((data) => {
        call.usage = data.usage ?? null;
        call.finishReason = data.choices?.[0]?.finish_reason ?? null;
        call.providerError = data.error?.message ?? null;
      })
      .catch(() => {
        call.unreadable = true;
      })
      .finally(() => {
        call.elapsedMs = Math.round(performance.now() - started);
      });
    return response;
  };
}

/** Run one planner turn with its own call log. */
export async function withTurn(turn, fn) {
  const state = { calls: [], blocked: [], ...turn };
  let value;
  let error = null;
  try {
    value = await turns.run(state, fn);
  } catch (caught) {
    error = caught;
  }
  await Promise.all(state.calls.map((call) => call.done));
  for (const call of state.calls) delete call.done;
  return { value, error, calls: state.calls, blocked: state.blocked };
}

/** What the planner sent, without the prompt text itself. */
function describeRequest(body) {
  const messages = body.messages ?? [];
  return {
    model: body.model,
    messages: messages.length,
    roles: messages.map((m) => m.role).join(","),
    images: messages
      .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
      .filter((part) => part.type === "image_url").length,
    tools: body.tools?.length ?? 0,
    responseFormat: body.response_format?.type ?? null,
    promptCacheKey: body.prompt_cache_key ?? null,
    reasoningEffort: body.reasoning_effort ?? body.reasoning?.effort ?? null,
    maxCompletionTokens: body.max_completion_tokens ?? null,
  };
}
