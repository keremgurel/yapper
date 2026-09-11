import { afterEach, describe, expect, it, vi } from "vitest";
import { createTikTokMediaUrl, readTikTokMediaGrant } from "./media-grant";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
describe("TikTok media capabilities", () => {
  function grant(key = "u/owner/original.mp4") {
    vi.useFakeTimers();
    vi.setSystemTime(1_800_000_000_000);
    vi.stubEnv("PUBLISH_TOKEN_KEY", Buffer.alloc(32, 1).toString("base64"));
    return new URL(createTikTokMediaUrl(key)).pathname.split("/").at(-1)!;
  }
  it("permits exactly the signed object for one hour", () => {
    const token = grant();
    expect(readTikTokMediaGrant(token)).toBe("u/owner/original.mp4");
    vi.advanceTimersByTime(3_600_000);
    expect(readTikTokMediaGrant(token)).toBeNull();
  });
  it("rejects changed keys, signatures and unsigned tokens", () => {
    const token = grant();
    const [payload, signature] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    const changed = Buffer.from(
      JSON.stringify({ ...decoded, key: "u/other/private.mp4" }),
    ).toString("base64url");
    expect(readTikTokMediaGrant(`${changed}.${signature}`)).toBeNull();
    expect(
      readTikTokMediaGrant(`${payload}.${signature.slice(0, -1)}!`),
    ).toBeNull();
    expect(readTikTokMediaGrant(payload)).toBeNull();
    expect(readTikTokMediaGrant(`${token}.extra`)).toBeNull();
  });
  it("rejects keys outside owned media and non-HTTPS origins", () => {
    expect(readTikTokMediaGrant(grant("system/secret"))).toBeNull();
    vi.stubEnv("TIKTOK_MEDIA_ORIGIN", "http://ypr.app");
    expect(() => createTikTokMediaUrl("u/owner/file")).toThrow(
      "invalid_tiktok_media_origin",
    );
  });
});
