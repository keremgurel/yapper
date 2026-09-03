import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Provider keys for the opt-in live tests.
 *
 * Next's `loadEnvConfig` deliberately skips `.env.local` when NODE_ENV is
 * "test", which is what vitest sets, so under it the live tests saw no key and
 * every design failed as `no_provider` in a few milliseconds. This reads the
 * file the developer already has, and only fills in variables the shell did
 * not set, so an exported key still wins.
 */
export function loadLiveEnv(root = process.cwd()): void {
  const path = join(root, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    process.env[key] = value;
  }
}
