// Daily cumulative GitHub release-asset download counters. These are transfers,
// not unique downloaders, installations, or downloads during a reporting range.
import { credentials } from "./posthog.mjs";
import { readFileSync } from "node:fs";
const publicProject = JSON.parse(
  readFileSync(
    new URL("../../docs/analytics/public-project.json", import.meta.url),
    "utf8",
  ),
);
const args = process.argv.slice(2);
const env = credentials(
  args.includes("--credentials-root")
    ? args[args.indexOf("--credentials-root") + 1]
    : process.cwd(),
);
const publicToken =
  env.NEXT_PUBLIC_POSTHOG_KEY || publicProject.publicIngestionToken;
if (!publicToken?.startsWith("phc_"))
  throw new Error("NEXT_PUBLIC_POSTHOG_KEY is required");
const headers = {
  Accept: "application/vnd.github+json",
  ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
};
const releases = [];
for (let page = 1; page <= 20; page++) {
  const response = await fetch(
    `https://api.github.com/repos/keremgurel/yapper/releases?per_page=100&page=${page}`,
    { headers, signal: AbortSignal.timeout(30_000) },
  );
  if (!response.ok) throw new Error(`GitHub releases: ${response.status}`);
  const batch = await response.json();
  releases.push(...batch);
  if (batch.length < 100) break;
  if (page === 20) throw new Error("Release pagination exceeds safety limit");
}
const timestamp = new Date().toISOString();
const batch = releases
  .filter((r) => !r.draft && !r.prerelease)
  .flatMap((release) =>
    release.assets
      .filter((a) => /\.(dmg|zip|pkg)$/i.test(a.name))
      .map((asset) => ({
        event: "release_download_snapshot",
        timestamp,
        properties: {
          distinct_id: `github-release-asset:${asset.id}`,
          $process_person_profile: false,
          product: "studio",
          environment: "production",
          source: "github",
          analytics_schema_version: 1,
          release_version: release.tag_name,
          asset_id: String(asset.id),
          asset_name: asset.name,
          download_count: asset.download_count,
        },
      })),
  );
if (!args.includes("--apply")) {
  console.log(
    JSON.stringify(
      batch.map((e) => e.properties),
      null,
      2,
    ),
  );
  process.exit(0);
}
for (let start = 0; start < batch.length; start += 100) {
  const response = await fetch("https://us.i.posthog.com/batch/", {
    method: "POST",
    signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: publicToken,
      batch: batch.slice(start, start + 100),
    }),
  });
  if (!response.ok) throw new Error(`PostHog ingestion: ${response.status}`);
}
console.log(JSON.stringify({ captured_assets: batch.length, timestamp }));
