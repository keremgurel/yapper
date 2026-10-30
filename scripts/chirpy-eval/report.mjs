import fs from "node:fs/promises";
import { mean, percentile, wilsonLower } from "./stats.mjs";

/** One row per model and variant: quality, cost, calls, cache and latency. */
export function summarize(attempts) {
  const groups = groupBy(attempts, (a) => `${a.model}\u0000${a.variant}`);
  const rows = [];
  for (const list of groups.values()) {
    const passes = list.filter((a) => a.pass).length;
    const safety = list.filter((a) => a.safety);
    const list$ = list.map((a) => a.listUsd).filter((v) => v != null);
    const settled = list.map((a) => a.settledUsd).filter((v) => v != null);
    const prompt = list.reduce((s, a) => s + a.promptTokens, 0);
    const cached = list.reduce((s, a) => s + a.cachedTokens, 0);
    rows.push({
      model: list[0].model,
      variant: list[0].variant,
      turns: list.length,
      passes,
      passRate: passes / list.length,
      wilsonLower: wilsonLower(passes, list.length),
      safetyPasses: safety.filter((a) => a.pass).length,
      safetyTurns: safety.length,
      listMean: mean(list$),
      listP95: percentile(list$, 95),
      settledMean: mean(settled),
      callsPerTurn: mean(list.map((a) => a.callCount)),
      cacheShare: prompt ? cached / prompt : 0,
      promptTokens: mean(list.map((a) => a.promptTokens)),
      outputTokens: mean(list.map((a) => a.outputTokens)),
      reasoningTokens: mean(list.map((a) => a.reasoningTokens)),
      latencyP50: percentile(
        list.map((a) => a.elapsedMs / 1000),
        50,
      ),
      latencyP95: percentile(
        list.map((a) => a.elapsedMs / 1000),
        95,
      ),
      errors: list.filter((a) => a.error).length,
    });
  }
  return rows.sort(
    (a, b) =>
      a.model.localeCompare(b.model) || a.variant.localeCompare(b.variant),
  );
}

const num = (v, digits) => (v == null ? "" : v.toFixed(digits));
const pct = (v) => (v == null ? "" : `${Math.round(v * 100)}%`);
const usd = (v) => (v == null ? "" : `$${v.toFixed(4)}`);

export function summaryTable(rows) {
  const head =
    "| Model | Variant | Turns | Pass | Wilson LB | Safety | List $/turn | List p95 | Settled $/turn | Calls/turn | Cache hit | Prompt tok | Out tok | Reasoning tok | p50 s | p95 s | Errors |\n" +
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |";
  const body = rows.map(
    (r) =>
      `| ${r.model} | ${r.variant} | ${r.turns} | ${pct(r.passRate)} | ${num(r.wilsonLower, 2)} | ${r.safetyPasses}/${r.safetyTurns} | ${usd(r.listMean)} | ${usd(r.listP95)} | ${r.settledMean == null ? "" : `$${r.settledMean.toFixed(6)}`} | ${num(r.callsPerTurn, 2)} | ${pct(r.cacheShare)} | ${Math.round(r.promptTokens)} | ${Math.round(r.outputTokens)} | ${Math.round(r.reasoningTokens)} | ${num(r.latencyP50, 1)} | ${num(r.latencyP95, 1)} | ${r.errors} |`,
  );
  return [head, ...body].join("\n");
}

/** Passes per case and model, so a regression points at the case that moved. */
export function caseTable(attempts) {
  const columns = [...new Set(attempts.map((a) => `${a.model} ${a.variant}`))];
  const cases = [...new Set(attempts.map((a) => a.case))].sort();
  const head =
    `| Case | ${columns.join(" | ")} |\n` +
    `| --- | ${columns.map(() => "---:").join(" | ")} |`;
  const body = cases.map((id) => {
    const cells = columns.map((column) => {
      const runs = attempts.filter(
        (a) => a.case === id && `${a.model} ${a.variant}` === column,
      );
      return runs.length
        ? `${runs.filter((a) => a.pass).length}/${runs.length}`
        : "";
    });
    const safety = attempts.find((a) => a.case === id)?.safety
      ? " (safety)"
      : "";
    return `| ${id}${safety} | ${cells.join(" | ")} |`;
  });
  return [head, ...body].join("\n");
}

/** The first failure reason of each failing attempt, grouped by case. */
export function failureList(attempts) {
  const failing = attempts.filter((a) => !a.pass);
  if (!failing.length) return "No failures.";
  return [...groupBy(failing, (a) => a.case)]
    .map(
      ([id, list]) =>
        `- ${id}\n` +
        list
          .map(
            (a) =>
              `  - ${a.model} ${a.variant} #${a.run}: ${(a.failures[0] ?? "").replace(/\n/g, " ").slice(0, 220)}`,
          )
          .join("\n"),
    )
    .join("\n");
}

export function markdownReport(attempts) {
  return [
    "## Summary",
    "",
    summaryTable(summarize(attempts)),
    "",
    "## Passes per case",
    "",
    caseTable(attempts),
    "",
    "## Failures",
    "",
    failureList(attempts),
    "",
  ].join("\n");
}

function groupBy(list, key) {
  const groups = new Map();
  for (const item of list) {
    const k = key(item);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  }
  return groups;
}

if (process.argv[1]?.endsWith("report.mjs")) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Usage: report.mjs <results.jsonl> [...]");
  const attempts = [];
  for (const file of files)
    for (const line of (await fs.readFile(file, "utf8"))
      .split("\n")
      .filter(Boolean))
      attempts.push(JSON.parse(line));
  console.log(markdownReport(attempts));
}
