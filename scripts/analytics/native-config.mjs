// Adds only the public ingestion token to a packaged app. Personal API keys
// are never embedded. Call before signing; plain swift run stays untracked.
import { execFileSync } from "node:child_process";
import { credentials } from "./posthog.mjs";
import { readFileSync } from "node:fs";
const publicProject = JSON.parse(
  readFileSync(
    new URL("../../docs/analytics/public-project.json", import.meta.url),
    "utf8",
  ),
);
const env = credentials();
const environment = env.YAPPER_ANALYTICS_ENVIRONMENT || "development";
if (!["production", "development"].includes(environment))
  throw new Error("Invalid analytics environment");
const token = env.NEXT_PUBLIC_POSTHOG_KEY || publicProject.publicIngestionToken;
if (environment === "production" && !token?.startsWith("phc_"))
  throw new Error("Production packages require NEXT_PUBLIC_POSTHOG_KEY");
if (token?.startsWith("phc_")) {
  for (const [key, value] of [
    ["YapperPostHogToken", token],
    ["YapperAnalyticsEnvironment", environment],
  ]) {
    execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", `Add :${key} string ${value}`, process.argv[2]],
      { stdio: "pipe" },
    );
  }
}
console.log(
  `Native analytics: ${token ? environment : "disabled (no public token)"}`,
);
