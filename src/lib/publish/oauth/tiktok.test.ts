import { afterEach, describe, expect, it, vi } from "vitest";
import { tiktok } from "@/lib/publish/oauth/tiktok";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tiktok.refreshAccessToken", () => {
  it("returns the rotated refresh token so it can be persisted", async () => {
    // TikTok's refresh grant returns a fresh refresh_token each time; dropping
    // it lets the stored one expire ~365 days after the original auth and breaks
    // the connection even though continuous refreshing would keep it alive.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: "NEW_ACCESS",
          refresh_token: "NEW_REFRESH",
          expires_in: 86_400,
        }),
      })),
    );

    const out = await tiktok.refreshAccessToken(
      { id: "x", secret: "y" },
      "OLD_REFRESH",
    );
    expect(out.accessToken).toBe("NEW_ACCESS");
    expect(out.refreshToken).toBe("NEW_REFRESH");
    expect(out.expiresAt).toBeInstanceOf(Date);
  });

  it("returns null (keep the stored token) when none comes back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ access_token: "A", expires_in: 86_400 }),
      })),
    );
    const out = await tiktok.refreshAccessToken(
      { id: "x", secret: "y" },
      "old",
    );
    expect(out.refreshToken).toBeNull();
  });

  it("throws when the provider returns no access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    await expect(
      tiktok.refreshAccessToken({ id: "x", secret: "y" }, "old"),
    ).rejects.toThrow("oauth_refresh_no_token");
  });
});
