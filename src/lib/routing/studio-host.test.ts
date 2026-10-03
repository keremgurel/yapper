import { describe, expect, it } from "vitest";
// Next matches redirect sources with its bundled path-to-regexp, which ships
// without types.
// @ts-expect-error untyped module
import { pathToRegexp } from "next/dist/compiled/path-to-regexp";
import { studioHost, studioHostRedirects } from "./studio-host";

const rules = studioHostRedirects("studio.ypr.app");
const rule = (source: string) => rules.find((r) => r.source === source)!;
const matches = (source: string, path: string) =>
  (pathToRegexp(source, [], { strict: true }) as RegExp).test(path);

describe("Studio on its own host", () => {
  it("is off until a host is configured", () => {
    expect(studioHost({})).toBeNull();
    expect(studioHost({ STUDIO_HOST: "  " })).toBeNull();
    expect(studioHostRedirects(null)).toEqual([]);
    expect(studioHost({ STUDIO_HOST: "Studio.YPR.app" })).toBe(
      "studio.ypr.app",
    );
  });

  it("sends website paths on the Studio host back to the website", () => {
    const website = rules[3].source;
    for (const path of [
      "/pricing",
      "/products/studio",
      "/blog/how-to-start-a-speech",
      "/training/read-aloud",
    ])
      expect(matches(website, path), path).toBe(true);
    for (const path of [
      "/studio/home",
      "/studio/library/abc",
      "/api/billing/status",
      "/_next/static/x.js",
      "/favicon.ico",
      "/images/a.png",
      "/__clerk/v1/client",
      "/",
    ])
      expect(matches(website, path), path).toBe(false);
  });

  it("moves browsers on the main host into the Studio host", () => {
    const move = rules[4];
    expect(move.has).toEqual([{ type: "host", value: "ypr.app" }]);
    expect(move.destination).toBe("https://studio.ypr.app/studio/:path");
    for (const path of ["/studio/home", "/studio/ideas/123", "/studio/poster"])
      expect(matches(move.source, path), path).toBe(true);
  });

  it("leaves the Mac app and its sign-in handoff on the main host", () => {
    const move = rules[4];
    expect(move.missing?.[0]).toMatchObject({ key: "user-agent" });
    for (const path of [
      "/studio/native-auth",
      "/studio/native-auth/callback",
      "/studio/handoff",
    ])
      expect(matches(move.source, path), path).toBe(false);
  });

  it("starts account connections on the main host", () => {
    expect(rule("/api/publish/connect/:platform").destination).toBe(
      "https://ypr.app/api/publish/connect/:platform",
    );
  });
});
