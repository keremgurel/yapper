import { afterEach, describe, expect, it, vi } from "vitest";
import { tiktok } from "@/lib/publish/oauth/tiktok";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("tiktok.buildAuthUrl", () => {
  it("shows authorization again while preserving the callback and CSRF state", () => {
    const callback = "https://ypr.app/api/publish/callback/tiktok";
    const url = new URL(
      tiktok.buildAuthUrl(
        { id: "client", secret: "secret" },
        callback,
        "nonce",
      ),
    );
    expect(url.origin + url.pathname).toBe(
      "https://www.tiktok.com/v2/auth/authorize/",
    );
    expect(url.searchParams.get("disable_auto_auth")).toBe("1");
    expect(url.searchParams.get("redirect_uri")).toBe(callback);
    expect(url.searchParams.get("state")).toBe("nonce");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });
});

describe("tiktok.exchangeCode", () => {
  it("identifies a client configuration failure even with HTTP 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          error: "invalid_client",
          error_description: "private details",
        }),
      })),
    );
    await expect(
      tiktok.exchangeCode(
        { id: "client", secret: "secret" },
        "code",
        "https://ypr.app/api/publish/callback/tiktok",
      ),
    ).rejects.toThrow("oauth_exchange_invalid_client");
  });

  it("does not copy unrecognized provider error text into logs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          error: "secret-from-provider",
          error_description: "private details",
        }),
      })),
    );
    await expect(
      tiktok.exchangeCode(
        { id: "client", secret: "secret" },
        "code",
        "https://ypr.app/api/publish/callback/tiktok",
      ),
    ).rejects.toThrow(/^oauth_exchange_failed$/);
  });

  it("returns the granted scopes and tokens for a successful connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: "access",
          refresh_token: "refresh",
          expires_in: 86400,
          scope: "user.info.basic,video.publish",
        }),
      })),
    );
    const tokens = await tiktok.exchangeCode(
      { id: "client", secret: "secret" },
      "code",
      "https://ypr.app/api/publish/callback/tiktok",
    );
    expect(tokens).toMatchObject({
      accessToken: "access",
      refreshToken: "refresh",
      scope: "user.info.basic,video.publish",
    });
    expect(tokens.expiresAt).toBeInstanceOf(Date);
  });
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

  it("names the OAuth error TikTok sends in the body of a 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          error: "invalid_grant",
          error_description: "Refresh token is invalid or expired.",
        }),
      })),
    );
    await expect(
      tiktok.refreshAccessToken({ id: "x", secret: "y" }, "old"),
    ).rejects.toThrow("oauth_refresh_invalid_grant");
  });
});
