import { withTurn } from "./capture.mjs";
import { scorePlan } from "./score.mjs";
import { listCostUsd, usageSummary } from "./surplus.mjs";

/**
 * One case, one model, one variant, one run: call the production planner
 * exactly as the route does, record every provider call it made, and score
 * the plan it returned. The caller sets AI_CHIRPY_MODEL for the model group.
 */
export async function runAttempt({
  planner,
  testCase,
  model,
  variant,
  run,
  prices,
}) {
  const input = testCase.build();
  const started = performance.now();
  const turn = await withTurn({ variant }, () => planner.planChirpy(input));
  const elapsedMs = Math.round(performance.now() - started);
  const plan = turn.value ?? null;
  const failures = turn.error
    ? [`planner threw ${turn.error.message}`]
    : scorePlan(testCase, plan, input);

  const price = prices.get(model);
  const calls = turn.calls.map((call) => ({
    status: call.status ?? null,
    model: call.request?.model ?? null,
    elapsedMs: call.elapsedMs ?? null,
    finishReason: call.finishReason ?? null,
    providerError: call.providerError ?? call.networkError ?? null,
    requestBytes: call.requestBytes ?? null,
    request: call.request ?? null,
    rewritten: call.rewritten ?? [],
    headers: call.headers ?? {},
    usage: usageSummary(call.usage),
    listUsd: listCostUsd(call.usage, price),
  }));
  const sum = (pick) =>
    calls.reduce((total, call) => total + (pick(call) ?? 0), 0);
  return {
    case: testCase.id,
    tags: testCase.tags,
    safety: testCase.safety,
    model,
    variant: variant.name,
    run,
    pass: failures.length === 0,
    failures,
    error: turn.error?.message ?? null,
    blockedEgress: turn.blocked,
    modelMismatch: calls.some((call) => call.model && call.model !== model),
    elapsedMs,
    calls,
    callCount: calls.length,
    promptTokens: sum((c) => c.usage.prompt),
    cachedTokens: sum((c) => c.usage.cached),
    outputTokens: sum((c) => c.usage.output),
    reasoningTokens: sum((c) => c.usage.reasoning),
    listUsd: price ? sum((c) => c.listUsd) : null,
    settledUsd: calls.every((c) => c.usage.settledMicro != null)
      ? sum((c) => c.usage.settledMicro) / 1e6
      : null,
    plan,
  };
}
