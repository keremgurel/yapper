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

describe("provider-spend route boundary", () => {
  it.each(ROUTES)(
    "%s separates ingress from validated provider spend",
    (relativePath, endpoint, firstCost) => {
      const source = readFileSync(
        join(process.cwd(), "src/app/api", relativePath),
        "utf8",
      );
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
      const source = readFileSync(
        join(process.cwd(), "src/app/api", relativePath),
        "utf8",
      );
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

  it("waitlist limits IP before parsing and email before Resend", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/waitlist/route.ts"),
      "utf8",
    );
    expect(source.indexOf("guardWaitlistIp(req)")).toBeLessThan(
      source.indexOf("req.json()"),
    );
    expect(source.indexOf("guardWaitlistEmail(trimmed)")).toBeLessThan(
      source.indexOf("new Resend("),
    );
  });
});
