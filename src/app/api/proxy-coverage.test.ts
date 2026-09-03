import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every API route that calls Clerk's `auth()` must be registered in the proxy.
 *
 * `auth()` throws outside a Clerk-matched request, so an unregistered route
 * does not return 401 — it returns a 500, and any client that treats failure as
 * "no data" degrades silently. That is exactly how `/api/views` shipped with
 * its whole feature invisible: the fetch 500'd, the hook fell back to an empty
 * list, and the view tabs simply never rendered.
 *
 * A grep-level check rather than a request-level one, because the failure is in
 * configuration rather than in any single handler.
 */

const API_DIR = join(process.cwd(), "src/app/api");
const PROXY = readFileSync(join(process.cwd(), "src/proxy.ts"), "utf8");

/** Routes that are deliberately public: third-party callers cannot present a
 * Clerk session, so they authenticate by signature or by nothing at all. */
const PUBLIC = new Set(["webhooks", "stripe", "waitlist"]);

function routeGroups(): string[] {
  return readdirSync(API_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !PUBLIC.has(name));
}

/** Whether any route file under this group asks Clerk who the caller is. */
function usesClerkAuth(group: string): boolean {
  const stack = [join(API_DIR, group)];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push(path);
        continue;
      }
      if (entry.name !== "route.ts") continue;
      if (readFileSync(path, "utf8").includes("@clerk/nextjs/server")) {
        return true;
      }
    }
  }
  return false;
}

describe("proxy coverage", () => {
  const groups = routeGroups().filter(usesClerkAuth);

  it.each(["direct-overlays", "design-overlays", "revise-overlay"])(
    "includes delegated scene auth for /api/%s in the matcher",
    (group) => {
      // These route files delegate auth() to the shared scene handler, so the
      // direct-import scan below cannot discover their Clerk dependency.
      const matcher = PROXY.slice(PROXY.indexOf("matcher: ["));
      expect(matcher).toContain(`"/api/${group}"`);
    },
  );

  it("finds the API groups to check", () => {
    // Guards the test itself: a broken walk would vacuously pass everything.
    expect(groups.length).toBeGreaterThan(5);
  });

  it.each(groups)("registers /api/%s as a protected route", (group) => {
    expect(PROXY).toContain(`"/api/${group}`);
  });

  it.each(groups)("includes /api/%s in the middleware matcher", (group) => {
    // Without a matcher entry the middleware never runs for the route, so the
    // protection list above would be inert for it.
    const matcher = PROXY.slice(PROXY.indexOf("matcher: ["));
    expect(matcher).toContain(`"/api/${group}`);
  });
});
