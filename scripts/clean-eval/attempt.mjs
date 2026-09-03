import { cutsFromKeptSpans } from "../../src/lib/studio/retake-keep-spans.ts";
import { legacyBlockCuts } from "./legacy-blocks.mjs";
import { explainRejection } from "./explain.mjs";
import { buildMessages } from "./prompts.mjs";
import { lenientBlockCuts } from "./normalize.mjs";
import { keepOnlySchema, retakeEditSchema } from "./schema.mjs";
import { scoreCuts } from "./score.mjs";
import { catalog, complete, listCost } from "./surplus.mjs";

/**
 * One model, one variant, one run: build the request the way the route
 * would, call Surplus, validate with the production validator, optionally
 * repair once, and score against the audited edit.
 */
export async function runAttempt({ model, variant, fixture, run }) {
  const prices = await catalog();
  const price = prices.get(model);
  const supports = price?.params ?? new Set();
  const wordCount = fixture.words.length;
  const messages = buildMessages(fixture, variant);

  const body = {
    model,
    temperature: 0,
    max_completion_tokens: variant.maxCompletionTokens,
    messages,
  };
  let reasoningSent = null;
  if (variant.reasoning) {
    if (supports.has("reasoning")) {
      body.reasoning = { effort: variant.reasoning };
      reasoningSent = "reasoning";
    } else if (supports.has("reasoning_effort")) {
      body.reasoning_effort = variant.reasoning;
      reasoningSent = "reasoning_effort";
    }
  }
  let schemaSent = false;
  if (
    variant.schema &&
    (supports.has("structured_outputs") || supports.has("response_format"))
  ) {
    body.response_format =
      variant.contract === "keep"
        ? keepOnlySchema(wordCount)
        : retakeEditSchema(wordCount);
    schemaSent = true;
  }

  const calls = [];
  let first = await complete(body);
  calls.push(first);
  // A provider that refuses a parameter answers 4xx in a second or two. Walk
  // the request down one parameter at a time so the run still measures the
  // model: reasoning as an object, then reasoning_effort, then none; then the
  // schema. Each fallback is recorded.
  const fallbacks = [];
  const refused = (r) => r.status >= 400 && r.status < 500;
  if (refused(first) && body.reasoning && supports.has("reasoning_effort")) {
    delete body.reasoning;
    body.reasoning_effort = variant.reasoning;
    reasoningSent = "reasoning_effort";
    fallbacks.push("reasoning->reasoning_effort");
    first = await complete(body);
    calls.push(first);
  }
  if (refused(first) && (body.reasoning || body.reasoning_effort)) {
    delete body.reasoning;
    delete body.reasoning_effort;
    reasoningSent = "refused";
    fallbacks.push("reasoning dropped");
    first = await complete(body);
    calls.push(first);
  }
  let schemaFallback = false;
  if (refused(first) && schemaSent) {
    delete body.response_format;
    schemaFallback = true;
    fallbacks.push("schema dropped");
    first = await complete(body);
    calls.push(first);
  }

  // How an answer is read: production strict, blocks read leniently, or the
  // keep only contract. `strictWouldReject` records what production would do.
  const read = (text) => {
    if (!text) return { cuts: null, notes: [] };
    if (variant.contract === "keep")
      return { cuts: cutsFromKeptSpans(text, wordCount), notes: [] };
    if (variant.lenient) return lenientBlockCuts(text, wordCount);
    return { cuts: legacyBlockCuts(text, wordCount), notes: [] };
  };
  let answer = first.answer;
  let reading = read(answer);
  let cuts = reading.cuts;
  const strictWouldReject =
    variant.contract === "blocks" && answer
      ? legacyBlockCuts(answer, wordCount) === null
      : null;
  let repaired = false;
  let repairProblems = null;
  if (!cuts && variant.repair && first.status === 200 && answer.trim()) {
    repairProblems = explainRejection(answer, wordCount);
    const repairBody = {
      ...body,
      messages: [
        ...messages,
        { role: "assistant", content: answer },
        {
          role: "user",
          content:
            "That answer was rejected by the validator:\n- " +
            repairProblems.join("\n- ") +
            "\nReturn the corrected JSON only, same contract, fixing every " +
            "listed problem without changing decisions that were not listed.",
        },
      ],
    };
    const second = await complete(repairBody);
    calls.push(second);
    if (second.status === 200 && second.answer.trim()) {
      const repairedReading = read(second.answer);
      if (repairedReading.cuts) {
        cuts = repairedReading.cuts;
        reading = repairedReading;
        answer = second.answer;
        repaired = true;
      }
    }
  }

  const usage = calls.reduce(
    (sum, c) => ({
      prompt_tokens: sum.prompt_tokens + (c.usage?.prompt_tokens ?? 0),
      completion_tokens:
        sum.completion_tokens + (c.usage?.completion_tokens ?? 0),
      reasoning_tokens:
        sum.reasoning_tokens +
        (c.usage?.completion_tokens_details?.reasoning_tokens ?? 0),
    }),
    { prompt_tokens: 0, completion_tokens: 0, reasoning_tokens: 0 },
  );

  return {
    model,
    variant: variant.name,
    run,
    valid: cuts !== null,
    strictWouldReject,
    readingNotes: reading.notes,
    repaired,
    repairProblems,
    reasoningSent,
    schemaSent,
    schemaFallback,
    fallbacks,
    status: calls.map((c) => c.status),
    finishReason: calls.map((c) => c.finishReason),
    requestIds: calls.map((c) => c.requestId),
    adaptedParams: calls.map((c) => c.adaptedParams),
    providerError: calls.map((c) => c.error?.message ?? null),
    elapsedMs: calls.reduce((sum, c) => sum + c.elapsedMs, 0),
    calls: calls.length,
    usage,
    listCostUsd: listCost(usage, price),
    rejection: cuts
      ? null
      : variant.contract === "keep"
        ? reading.notes
        : explainRejection(answer, wordCount).slice(0, 4),
    ...(cuts ? scoreCuts(cuts, fixture) : {}),
    answer,
  };
}
