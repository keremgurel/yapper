// Read-only by default. Validate every query before --apply changes PostHog.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { credentials, posthogAPI } from "./posthog.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const credentialsRoot = args.includes("--credentials-root")
  ? args[args.indexOf("--credentials-root") + 1]
  : root;
const api = posthogAPI(credentials(credentialsRoot));
const config = JSON.parse(
  readFileSync(resolve(root, "docs/analytics/dashboard.json"), "utf8"),
);
if (args.includes("--only")) {
  const keys = args[args.indexOf("--only") + 1].split(",");
  if (keys.some((key) => !config.charts.some((chart) => chart.key === key)))
    throw new Error("Unknown chart key");
  config.charts = config.charts.filter((chart) => keys.includes(chart.key));
  config.sections = [];
}
const project = await api("/");
if (project.id !== config.projectId) throw new Error("Wrong project");
for (const chart of config.charts) {
  chart.query.source.query = readFileSync(
    resolve(root, "docs/analytics/queries", chart.key + ".sql"),
    "utf8",
  );
  const result = await api("/query/", { query: chart.query.source });
  if (result.error || result.hasMore)
    throw new Error(`Incomplete query: ${chart.key}`);
  console.log(
    JSON.stringify({ validated: chart.key, rows: result.results?.length }),
  );
}
if (!args.includes("--apply") || args.includes("--check")) process.exit(0);
const listed = await api("/dashboards/?limit=100");
if (listed.next)
  throw new Error("Dashboard listing paginated; refusing ambiguous creation");
const matches = listed.results.filter(
  (d) => !d.deleted && d.name === config.name,
);
if (matches.length > 1)
  throw new Error("Duplicate dashboard names; resolve manually");
const dashboard =
  matches[0] ??
  (await api("/dashboards/", {
    name: config.name,
    description: config.description,
    tags: ["yapper-overview"],
    pinned: true,
  }));
const path = `/dashboards/${dashboard.id}/`;
const before = await api(path);
const backup = resolve(root, ".analytics-private");
mkdirSync(backup, { recursive: true, mode: 0o700 });
writeFileSync(
  resolve(backup, `${Date.now()}-dashboard.json`),
  JSON.stringify(before),
  { mode: 0o600 },
);
const ids = new Map();
for (const chart of config.charts) {
  const tag = `yapper-overview:${chart.key}`;
  const existing = before.tiles.find((t) =>
    t.insight?.tags?.includes(tag),
  )?.insight;
  const body = {
    name: chart.name,
    description: chart.description,
    query: chart.query,
    saved: true,
    tags: [...new Set([...(existing?.tags ?? []), "yapper-overview", tag])],
    dashboards: [...new Set([...(existing?.dashboards ?? []), dashboard.id])],
  };
  const saved = await api(
    existing ? `/insights/${existing.id}/` : "/insights/",
    body,
    existing ? "PATCH" : "POST",
  );
  ids.set(chart.key, saved.id);
}
const current = await api(path);
const layout = (id, [x, y, w, h]) => ({ sm: { i: String(id), x, y, w, h } });
const tiles = config.charts.map((chart) => {
  const tile = current.tiles.find((t) => t.insight?.id === ids.get(chart.key));
  const old = before.tiles.find((t) => t.id === tile.id);
  return {
    id: tile.id,
    layouts:
      old?.layouts && !args.includes("--reset-layout")
        ? old.layouts
        : layout(tile.id, chart.layout),
    show_description: false,
  };
});
for (const section of config.sections) {
  const old = current.tiles.find(
    (t) => t.text?.body?.split("\n")[0] === section.body.split("\n")[0],
  );
  tiles.push({
    ...(old ? { id: old.id } : {}),
    text: { ...(old ? { id: old.text.id } : {}), body: section.body },
    layouts:
      old?.layouts && !args.includes("--reset-layout")
        ? old.layouts
        : layout(old?.id ?? section.key, section.layout),
  });
}
await api(
  path,
  {
    description: config.description,
    pinned: true,
    filters: {
      ...before.filters,
      date_from: before.filters?.date_from ?? "-30d",
      date_to: null,
    },
    tiles,
  },
  "PATCH",
);
const after = await api(path);
for (const id of ids.values())
  if (!after.tiles.some((t) => t.insight?.id === id))
    throw new Error(`Missing insight ${id}`);
for (const tile of before.tiles)
  if (!after.tiles.some((t) => t.id === tile.id))
    throw new Error(`Lost existing tile ${tile.id}`);
console.log(
  JSON.stringify({
    dashboard: `https://us.posthog.com/project/383795/dashboard/${dashboard.id}`,
    charts: ids.size,
  }),
);
