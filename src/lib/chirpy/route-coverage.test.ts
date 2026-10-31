import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import contract from "../../../protocol/app-actions.schema.json";
import {
  EXCLUDED_ROUTES,
  ROUTE_ACTIONS,
  UNCOVERED_ROUTES,
} from "./route-coverage";

const API = path.join(process.cwd(), "src/app/api");
const MUTATING =
  /export\s+(?:async\s+function|const)\s+(POST|PUT|PATCH|DELETE)\b/g;

function routeFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

/** "METHOD /api/path" for every mutating export under src/app/api. */
function mutatingExports(): string[] {
  return routeFiles(API).flatMap((file) => {
    const route = `/api/${path
      .relative(API, path.dirname(file))
      .split(path.sep)
      .join("/")}`;
    const source = readFileSync(file, "utf8");
    return [...source.matchAll(MUTATING)].map(
      ([, method]) => `${method} ${route}`,
    );
  });
}

describe("Chirpy route coverage", () => {
  const routes = mutatingExports();
  const lists = {
    ROUTE_ACTIONS: Object.keys(ROUTE_ACTIONS),
    EXCLUDED_ROUTES: Object.keys(EXCLUDED_ROUTES),
    UNCOVERED_ROUTES: Object.keys(UNCOVERED_ROUTES),
  };

  it("finds the routes", () => {
    expect(routes).toContain("POST /api/ideas");
    expect(routes.length).toBeGreaterThan(50);
  });

  it("puts every mutating export in exactly one list", () => {
    const unlisted = routes.filter(
      (route) => !Object.values(lists).some((keys) => keys.includes(route)),
    );
    expect(
      unlisted,
      "Map these to Chirpy actions in src/lib/chirpy/route-coverage.ts, or list why not",
    ).toEqual([]);
    const twice = routes.filter(
      (route) =>
        Object.values(lists).filter((keys) => keys.includes(route)).length > 1,
    );
    expect(twice).toEqual([]);
  });

  it("lists no route that no longer exists", () => {
    const stale = Object.values(lists)
      .flat()
      .filter((route) => !routes.includes(route));
    expect(stale).toEqual([]);
  });

  it("maps routes only to actions the contract has", () => {
    const known = new Set(contract["x-actions"].map((action) => action.id));
    const unknown = Object.values(ROUTE_ACTIONS)
      .flat()
      .filter((id) => !known.has(id));
    expect(unknown).toEqual([]);
  });

  it("maps every Studio action to the route a control uses", () => {
    const mapped = new Set(Object.values(ROUTE_ACTIONS).flat());
    const studio = contract["x-actions"]
      .filter((action) => action.runtime === "server")
      .map((action) => action.id)
      .filter((id) => !mapped.has(id));
    expect(studio).toEqual([]);
  });
});
