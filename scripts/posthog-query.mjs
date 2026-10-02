// Read-only HogQL query against Yapper's PostHog project.
//
//   node scripts/posthog-query.mjs "select event, count() from events where timestamp > now() - interval 7 day group by event order by 2 desc limit 20"
//
// Needs POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in .env.local (see
// AGENTS.md). The key stays in .env.local, which is gitignored. Only SELECT
// statements are sent, and results print as JSON rows.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

function readEnv(file) {
  try {
    return Object.fromEntries(
      readFileSync(resolve(ROOT, file), "utf8")
        .split("\n")
        .filter((line) => /^[A-Z0-9_]+=/.test(line))
        .map((line) => {
          const at = line.indexOf("=");
          return [
            line.slice(0, at),
            line.slice(at + 1).replace(/^["']|["']$/g, ""),
          ];
        }),
    );
  } catch {
    return {};
  }
}

const env = { ...readEnv(".env.local"), ...process.env };
const key = env.POSTHOG_PERSONAL_API_KEY;
const project = env.POSTHOG_PROJECT_ID;
const host = (env.POSTHOG_API_HOST || "https://us.posthog.com").replace(
  /\/$/,
  "",
);
const query = process.argv.slice(2).join(" ").trim();

if (!key || !project) {
  console.error(
    "Set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in .env.local.",
  );
  process.exit(2);
}
if (!/^\s*(select|with)\b/i.test(query)) {
  console.error('Pass one HogQL SELECT, e.g. "select count() from events".');
  process.exit(2);
}

const response = await fetch(`${host}/api/projects/${project}/query/`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(
    `PostHog answered ${response.status}: ${body.detail ?? body.error ?? "request failed"}`,
  );
  process.exit(1);
}
const columns = body.columns ?? [];
console.log(
  JSON.stringify(
    (body.results ?? []).map((row) =>
      Object.fromEntries(row.map((value, index) => [columns[index], value])),
    ),
    null,
    2,
  ),
);
