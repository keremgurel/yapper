import { afterEach, describe, expect, it } from "vitest";
import { publishPlatforms } from "@/lib/db/schema";
import {
  PLATFORMS,
  configuredPlatforms,
  isPlatformConfigured,
  platformSpec,
} from "@/lib/publish/platforms";

describe("platform registry", () => {
  it("has a spec for every db platform, keyed by its own id", () => {
    for (const p of publishPlatforms) {
      expect(PLATFORMS[p].id).toBe(p);
      expect(platformSpec(p)).toBe(PLATFORMS[p]);
    }
    expect(Object.keys(PLATFORMS).sort()).toEqual([...publishPlatforms].sort());
  });

  it("only Instagram pulls the video from a public URL", () => {
    const needing = publishPlatforms.filter((p) => PLATFORMS[p].needsPublicUrl);
    expect(needing).toEqual(["instagram"]);
  });

  it("only Instagram requires a Professional (Business/Creator) account", () => {
    const gated = publishPlatforms.filter(
      (p) => PLATFORMS[p].requiresProfessional,
    );
    expect(gated).toEqual(["instagram"]);
  });

  it("every platform requests at least one scope and names both env vars", () => {
    for (const p of publishPlatforms) {
      const spec = PLATFORMS[p];
      expect(spec.scopes.length).toBeGreaterThan(0);
      expect(spec.env.clientId).toBeTruthy();
      expect(spec.env.clientSecret).toBeTruthy();
    }
  });
});

describe("configuration gating", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("needs BOTH the id and secret to count as configured", () => {
    delete process.env.YOUTUBE_CLIENT_ID;
    delete process.env.YOUTUBE_CLIENT_SECRET;
    expect(isPlatformConfigured("youtube")).toBe(false);

    process.env.YOUTUBE_CLIENT_ID = "id";
    expect(isPlatformConfigured("youtube")).toBe(false); // secret still missing

    process.env.YOUTUBE_CLIENT_SECRET = "secret";
    expect(isPlatformConfigured("youtube")).toBe(true);
  });

  it("configuredPlatforms lists only the fully configured ones", () => {
    for (const p of publishPlatforms) {
      delete process.env[PLATFORMS[p].env.clientId];
      delete process.env[PLATFORMS[p].env.clientSecret];
    }
    expect(configuredPlatforms()).toEqual([]);

    process.env.TIKTOK_CLIENT_KEY = "k";
    process.env.TIKTOK_CLIENT_SECRET = "s";
    expect(configuredPlatforms()).toEqual(["tiktok"]);
  });
});
