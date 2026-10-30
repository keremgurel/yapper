import fs from "node:fs/promises";
import path from "node:path";
import { list, parseArgs, stamp } from "../cli.mjs";
import { loadEvalEnv, ROOT } from "../env.mjs";
import { loadPlanner } from "../load-planner.mjs";
import { complete, usageSummary } from "../surplus.mjs";
import {
  actionTools,
  fromStrict,
  LIMIT_KEYWORDS,
  loadContract,
  planResponseFormat,
  toolName,
} from "./strict-transform.mjs";

/**
 * Do strict function tools and strict json_schema output accept our action
 * schemas once optional fields are nullable and uniqueItems is stripped?
 *
 *   node scripts/chirpy-eval/probes/strict.mjs \
 *     [--models gpt-5.4,gpt-5.4-mini,gemini-3.7-flash,claude-haiku-5.5] [--bisect]
 *
 * For each model and mode it sends the same small caption request twice
 * (the first call pays any schema compile), reads the tool call or JSON
 * plan back, strips the nulls and validates the arguments with the
 * production validator. When a mode is refused it retries with the length
 * and range limits stripped; --bisect then finds the tools at fault.
 */
const args = parseArgs();
loadEvalEnv();
const { validate } = await loadPlanner();
const contract = await loadContract();
const models = list(
  args.models ?? "gpt-5.4,gpt-5.4-mini,gemini-3.7-flash,claude-haiku-5.5",
);
const inputFor = new Map(contract["x-actions"].map((a) => [a.id, a.input]));
const idForTool = new Map(
  contract["x-actions"].map((a) => [toolName(a.id), a.id]),
);

const captionIDs = [
  "5A3C7E2B-1F4D-4E8A-9C6B-2D7E8F9A0B1C",
  "8B9C0D1E-2F3A-4B5C-8D7E-9F0A1B2C3D4E",
];
const messages = [
  {
    role: "system",
    content:
      "You are Chirpy, the editor's assistant. Plan the user's request with the supplied actions. Use only IDs from the context.",
  },
  {
    role: "user",
    content: JSON.stringify({
      context: {
        captionsVisible: true,
        captionStyle: { fontScale: 0.05, color: "#FFFFFF", y: 0.8 },
        timelineItems: captionIDs.map((id, i) => ({
          id,
          kind: "caption",
          start: i * 2,
          end: i * 2 + 2,
        })),
      },
      request: "Make all the captions a bit bigger and yellow.",
    }),
  },
];

function checkArguments(id, raw) {
  const input = inputFor.get(id);
  if (!input) return `unknown action ${id}`;
  const value = fromStrict(typeof raw === "string" ? JSON.parse(raw) : raw);
  return validate(value, contract.$defs[input])
    ? null
    : `invalid arguments for ${id}: ${JSON.stringify(value).slice(0, 200)}`;
}

function readReply(mode, reply) {
  try {
    if (mode === "tools") {
      if (!reply.toolCalls.length)
        return { actions: [], problem: "no tool call" };
      const actions = reply.toolCalls.map(
        (call) => idForTool.get(call.function.name) ?? call.function.name,
      );
      const problem = reply.toolCalls
        .map((call) =>
          checkArguments(
            idForTool.get(call.function.name),
            call.function.arguments,
          ),
        )
        .find(Boolean);
      return { actions, problem: problem ?? null };
    }
    const plan = JSON.parse(reply.content);
    const problem = plan.actions
      .map((call) => checkArguments(call.action, call.arguments))
      .find(Boolean);
    return {
      actions: plan.actions.map((call) => call.action),
      problem: problem ?? null,
    };
  } catch (error) {
    return { actions: [], problem: `unparseable: ${error.message}` };
  }
}

function body(
  model,
  mode,
  options,
  tools = actionTools(contract, options).map((t) => t.tool),
) {
  const request = { model, max_completion_tokens: 2000, messages };
  if (mode === "tools")
    Object.assign(request, { tools, tool_choice: "required" });
  else request.response_format = planResponseFormat(contract, options);
  return request;
}

// The gateway can answer 200 and put the provider's refusal in the body.
const refused = (reply) => reply.status !== 200 || reply.error != null;

async function probe(model, mode, optionName, options) {
  const calls = [];
  for (let i = 0; i < 2; i++) {
    const reply = await complete(body(model, mode, options), {
      timeoutMs: 180_000,
    });
    calls.push({
      ...reply,
      ...(refused(reply) ? {} : readReply(mode, reply)),
    });
    if (refused(reply)) break;
  }
  const [first, second] = calls;
  return {
    model,
    mode,
    schema: optionName,
    accepted: !refused(first),
    status: first.status,
    error: first.error?.message?.slice(0, 300) ?? null,
    firstMs: first.elapsedMs,
    secondMs: second?.elapsedMs ?? null,
    promptTokens: usageSummary(first.usage).prompt,
    cachedSecond: second ? usageSummary(second.usage).cached : null,
    provider: first.headers["x-si-provider-family"] ?? null,
    adapted: first.headers["x-si-adapted-params"] ?? null,
    actions: calls.map((c) => (c.actions ?? []).join("+")),
    problems: calls.map((c) => c.problem).filter(Boolean),
  };
}

/** Send each tool alone to find the ones a provider refuses. */
async function bisect(model) {
  const rejected = [];
  for (const { id, tool } of actionTools(contract)) {
    const reply = await complete(body(model, "tools", {}, [tool]), {
      timeoutMs: 180_000,
    });
    if (refused(reply))
      rejected.push(`${id}: ${oneLine(reply.error?.message).slice(0, 160)}`);
  }
  return rejected;
}

const oneLine = (text) => (text ?? "").replace(/\s+/g, " ");

const results = [];
for (const model of models) {
  for (const mode of ["tools", "json_schema"]) {
    const result = await probe(model, mode, "nullable", {});
    results.push(result);
    console.error(JSON.stringify(result));
    if (!result.accepted) {
      const bare = await probe(model, mode, "nullable, limits stripped", {
        strip: LIMIT_KEYWORDS,
      });
      results.push(bare);
      console.error(JSON.stringify(bare));
      if (mode === "tools" && args.bisect === "true")
        result.refusedTools = await bisect(model);
    }
  }
}

const table = [
  "| Model | Mode | Schema | Accepted | First s | Second s | Prompt tok | Cached on 2nd | Provider | Actions | Validation |",
  "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- | --- |",
  ...results.map(
    (r) =>
      `| ${r.model} | ${r.mode} | ${r.schema} | ${r.accepted ? "yes" : `no (${r.status}: ${oneLine(r.error).replace(/\|/g, "/").slice(0, 120)})`} | ${(r.firstMs / 1000).toFixed(1)} | ${r.secondMs == null ? "" : (r.secondMs / 1000).toFixed(1)} | ${r.promptTokens} | ${r.cachedSecond ?? ""} | ${r.provider ?? ""} | ${r.actions.join(" / ")} | ${r.problems.length ? r.problems[0].replace(/\|/g, "/") : r.accepted ? "valid" : ""} |`,
  ),
].join("\n");
console.log(table);
for (const r of results.filter((r) => r.refusedTools?.length))
  console.log(`\n${r.model} refused tools:\n- ${r.refusedTools.join("\n- ")}`);
const out = path.join(
  ROOT,
  `scripts/chirpy-eval/results/probe-strict-${stamp()}.json`,
);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(results, null, 2));
console.error(`results: ${path.relative(process.cwd(), out)}`);
