import { afterEach, describe, expect, it, vi } from "vitest";
import { instagram } from "@/lib/publish/oauth/instagram";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("instagram.refreshAccessToken", () => {
  it("returns the rotated long-lived token as the new refresh token", async () => {
    // Instagram refreshes the long-lived token with itself: the response IS the
    // next token, and it must replace the stored one, or the connection breaks
    // ~60 days later when the old token (never updated) expires.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          access_token: "NEW_LLT",
          expires_in: 5_184_000,
        }),
      })),
    );

    const out = await instagram.refreshAccessToken(
      { id: "x", secret: "y" },
      "OLD_LLT",
    );
    expect(out.accessToken).toBe("NEW_LLT");
    expect(out.refreshToken).toBe("NEW_LLT");
    expect(out.expiresAt).toBeInstanceOf(Date);
  });

  it("throws when the provider returns no token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({}) })),
    );
    await expect(
      instagram.refreshAccessToken({ id: "x", secret: "y" }, "OLD_LLT"),
    ).rejects.toThrow("oauth_refresh_no_token");
  });
});
