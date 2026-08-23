import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CALLERS = [
  "app/api/clean-transcript/route.ts",
  "app/api/place-overlays/route.ts",
  "lib/brain/ask.ts",
  "lib/brain/context/select-model.ts",
  "lib/brain/ingest.ts",
  "lib/brain/spin.ts",
  "lib/content/brainstorm.ts",
  "lib/content/capture.ts",
  "lib/feedback/coach.ts",
  "lib/generate/hooks.ts",
  "lib/generate/idea.ts",
  "lib/generate/script.ts",
  "lib/ideas/expand.ts",
  "lib/inspiration/web-resource.ts",
  "lib/publish/caption.ts",
  "lib/training-feedback/coach.ts",
] as const;

function productionSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionSources(path);
    if (!/\.[jt]sx?$/.test(entry.name) || /\.test\.[jt]sx?$/.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

describe("Surplus Chat Completions egress boundary", () => {
  it.each(CALLERS)(
    "%s is bounded, cancellable and token-capped",
    (relative) => {
      const source = readFileSync(join(process.cwd(), "src", relative), "utf8");
      expect(source).toContain("/chat/completions");
      expect(source).toContain("fetchBoundedJson");
      expect(source).toContain("max_completion_tokens:");
      expect(source).toContain("MAX_PROVIDER_RESPONSE_BYTES");
      expect(source).toContain("signal");
      expect(source).not.toMatch(/\bmax_tokens\s*:/);
      expect(source).not.toMatch(
        /\b(?:res|response|providerResponse)\.json\(\)/,
      );
    },
  );

  it("enumerates every production Chat Completions caller", () => {
    const sourceRoot = join(process.cwd(), "src");
    const actual = productionSources(sourceRoot)
      .filter((path) =>
        readFileSync(path, "utf8").includes("/chat/completions"),
      )
      .map((path) => path.slice(sourceRoot.length + 1))
      .sort();
    expect(actual).toEqual([...CALLERS].sort());
  });
});
