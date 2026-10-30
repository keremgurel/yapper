import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Load SURPLUS_API_KEY from .env.local, then drop every variable that could
 * let an eval run reach a shared system: the database (budget windows, the
 * credit ledger) and PostHog. Code under test that needs them fails closed.
 */
export function loadEvalEnv() {
  dotenv.config({ path: path.join(ROOT, ".env.local"), quiet: true });
  for (const name of Object.keys(process.env)) {
    if (/^(DATABASE_URL|POSTGRES_|PG|NEXT_PUBLIC_POSTHOG|POSTHOG)/.test(name))
      delete process.env[name];
  }
  if (!process.env.SURPLUS_API_KEY)
    throw new Error(
      "SURPLUS_API_KEY is missing. In a worktree run bash scripts/link-worktree-env.sh first.",
    );
}
