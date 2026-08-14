import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const route = (platform: string) =>
  readFile(
    new URL(`../../app/api/publish/${platform}/route.ts`, import.meta.url),
    "utf8",
  );

describe("publish route streaming boundary", () => {
  it.each(["youtube", "tiktok"])(
    "%s streams R2 media through an owned temporary file",
    async (platform) => {
      const source = await route(platform);
      expect(source).toContain("getObjectFile");
      expect(source).not.toContain("getObjectBytes");
      expect(source).toMatch(/await file\s*\.cleanup\(\)\s*\.catch/);
      expect(source).toContain("signal: workflow.signal");
    },
  );

  it.each(["youtube", "tiktok", "instagram"])(
    "%s establishes its deadline before authentication or provider work",
    async (platform) => {
      const source = await route(platform);
      expect(
        source.indexOf("createPublishWorkflow(req.signal)"),
      ).toBeGreaterThan(-1);
      expect(source.indexOf("createPublishWorkflow(req.signal)")).toBeLessThan(
        source.indexOf("await auth()"),
      );
      expect(source).toContain("publishFailureStatus(e, workflow)");
    },
  );

  it.each(["youtube", "tiktok", "instagram"])(
    "%s never downgrades an accepted post when completion bookkeeping fails",
    async (platform) => {
      const source = await route(platform);
      expect(source).toContain("persistPublishCompletion");
      expect(source).toContain("notePublishJobPending");
      expect(source).toContain('error: "publish_state_pending"');
      expect(
        source.indexOf("instanceof PublishOutcomeUnknownError"),
      ).toBeLessThan(source.lastIndexOf("failPublishJob"));
      expect(source.lastIndexOf("failPublishJob")).toBeLessThan(
        source.lastIndexOf("persistPublishCompletion"),
      );
    },
  );
});
