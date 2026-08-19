import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { config } from "@/proxy";

/**
 * Every route that asks Clerk who is signed in has to sit behind the proxy.
 *
 * Clerk's `auth()` throws when the proxy did not run for that request, which
 * surfaces as a 500 with no clue in it. That is exactly what shipped: the
 * matcher listed `/api/transcribe` literally, `/api/transcribe/upload-url` is a
 * different path, and the editor could not transcribe at all. Listing routes by
 * hand is what let a subpath slip through, so the list is checked against the
 * routes that actually exist rather than maintained alongside them.
 */
function routeFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === "route.ts" || name === "route.tsx" ? [path] : [];
  });
}

/** "src/app/api/transcribe/upload-url/route.ts" -> "/api/transcribe/upload-url" */
function urlPath(file: string, apiRoot: string): string {
  const parts = relative(apiRoot, file).split(sep).slice(0, -1);
  return `/api/${parts.join("/")}`;
}

/**
 * Does a Next matcher entry cover this path?
 *
 * `/:name*` means zero or more segments, so "/api/content/:path*" covers the
 * collection at "/api/content" as well as everything under it.
 */
function covers(pattern: string, path: string): boolean {
  const source = pattern
    .replace(/\/:[A-Za-z]+\*/g, "__DEEP__")
    .replace(/\/:[A-Za-z]+/g, "__ONE__")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/__DEEP__/g, "(?:/.*)?")
    .replace(/__ONE__/g, "/[^/]+");
  return new RegExp(`^${source}$`).test(path);
}

describe("Clerk proxy coverage", () => {
  it("runs the proxy in front of every route that calls auth()", () => {
    const apiRoot = join(process.cwd(), "src", "app", "api");
    const uncovered = routeFiles(apiRoot)
      .filter((file) => /\bauth\s*\(\s*\)/.test(readFileSync(file, "utf8")))
      .map((file) => urlPath(file, apiRoot))
      // Dynamic segments are matched by the proxy's own wildcards; a literal
      // "[id]" in a path would never equal a real request path.
      .filter((path) => !path.includes("["))
      .filter((path) => !config.matcher.some((entry) => covers(entry, path)));

    expect(uncovered).toEqual([]);
  });
});
