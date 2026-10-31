import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROUTES = [
  ["feedback/route.ts", "feedback", "result = await runTier("],
  ["transcribe/route.ts", "transcribe", "reservePaidActionOrResponse("],
  [
    "clean-transcript/route.ts",
    "clean-transcript",
    "reservePaidActionOrResponse(",
  ],
  ["place-overlays/route.ts", "place-overlays", "reservePaidActionOrResponse("],
  ["generate/hooks/route.ts", "generate-hooks", "generateHooks("],
  ["generate/idea/route.ts", "generate-idea", "generateIdea("],
  ["generate/script/route.ts", "generate-script", "generateScript("],
  ["brain/ask/route.ts", "brain-ask", "reservePaidActionOrResponse("],
  ["brain/spin/route.ts", "brain-spin", "reservePaidActionOrResponse("],
  [
    "content/capture/route.ts",
    "content-capture",
    "reservePaidActionOrResponse(",
  ],
  [
    "content/brainstorm/route.ts",
    "content-brainstorm",
    "reservePaidActionOrResponse(",
  ],
  ["ideas/expand/route.ts", "ideas-expand", "reservePaidActionOrResponse("],
  [
    "content/[id]/versions/[format]/write/route.ts",
    "ideas-version",
    "reservePaidActionOrResponse(",
  ],
  [
    "inspiration/creator/route.ts",
    "inspiration-creator",
    "reservePaidActionOrResponse(",
  ],
  [
    "inspiration/resolve/route.ts",
    "inspiration-resolve",
    "reservePaidActionOrResponse(",
  ],
  [
    "publish/caption/route.ts",
    "publish-caption",
    "reservePaidActionOrResponse(",
  ],
  ["publish/instagram/import/route.ts", "instagram-import", "headObjectBytes("],
] as const;

const RESERVATION_ROUTES = ROUTES.filter(([, , firstCost]) =>
  firstCost.startsWith("reservePaidActionOrResponse("),
);

/** Routes whose guarded work lives in an operation they share with Chirpy:
 * the operation's source is read after the route's, so the same order holds
 * across both. */
const SHARED_SOURCE: Record<string, string> = {
  "publish/instagram/import/route.ts":
    "src/lib/publish/server/platform-import.ts",
  "ideas/expand/route.ts": "src/lib/ideas/operations/expand.ts",
  "content/[id]/versions/[format]/write/route.ts":
    "src/lib/ideas/operations/write-version.ts",
};

function routeSource(relativePath: string): string {
  const route = readFileSync(
    join(process.cwd(), "src/app/api", relativePath),
    "utf8",
  );
  const shared = SHARED_SOURCE[relativePath];
  return shared
    ? route + readFileSync(join(process.cwd(), shared), "utf8")
    : route;
}

describe("provider-spend route boundary", () => {
  it.each(ROUTES)(
    "%s separates ingress from validated provider spend",
    (relativePath, endpoint, firstCost) => {
      const source = routeSource(relativePath);
      const auth = source.indexOf("await auth()");
      const ingress = source.indexOf("guardProviderIngress(req)");
      const spend = source.lastIndexOf("guardProviderSpend(");
      expect(source.slice(spend, spend + 120)).toContain(`\"${endpoint}\"`);
      const bodyReaders = [
        source.indexOf("req.json()"),
        source.indexOf("req.arrayBuffer()"),
        source.indexOf("readBoundedJson(req"),
        source.indexOf("readBoundedBody(req"),
      ].filter((index) => index >= 0);
      const firstBodyRead = bodyReaders.length
        ? Math.min(...bodyReaders)
        : Infinity;
      const costBoundary = source.lastIndexOf(firstCost);

      expect(auth).toBeGreaterThanOrEqual(0);
      expect(ingress).toBeGreaterThan(auth);
      expect(ingress).toBeLessThan(firstBodyRead);
      expect(spend).toBeGreaterThan(firstBodyRead);
      expect(spend).toBeLessThan(costBoundary);
    },
  );

  it.each(RESERVATION_ROUTES)(
    "%s preflights before spend and reserves immediately after it",
    (relativePath) => {
      const source = routeSource(relativePath);
      const preflight = source.lastIndexOf("preflightPaidActionOrResponse(");
      const spend = source.lastIndexOf("guardProviderSpend(");
      const reservation = source.lastIndexOf("reservePaidActionOrResponse(");
      const bodyReaders = [
        source.indexOf("req.json()"),
        source.indexOf("req.arrayBuffer()"),
        source.indexOf("readBoundedJson(req"),
        source.indexOf("readBoundedBody(req"),
      ].filter((index) => index >= 0);
      const firstBodyRead = bodyReaders.length
        ? Math.min(...bodyReaders)
        : Infinity;

      expect(preflight).toBeGreaterThan(firstBodyRead);
      expect(preflight).toBeLessThan(spend);
      expect(reservation).toBeGreaterThan(spend);
      expect(source.slice(spend, reservation)).not.toContain("await fetch(");
    },
  );
});
