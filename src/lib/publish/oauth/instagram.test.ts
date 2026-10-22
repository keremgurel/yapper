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

const scopes = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_insights",
];
const credentials = { id: "client", secret: "secret" };
it.each([undefined, [scopes[0]], scopes.slice(0, 2)])(
  "rejects incomplete Instagram permissions before storing a connection",
  async (permissions) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ access_token: "short", permissions }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      instagram.exchangeCode(credentials, "code", "https://ypr.app/callback"),
    ).rejects.toThrow("instagram_permissions_required");
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it.each([{}, { access_token: "long" }, { expires_in: 3600 }])(
  "never falls back to a short-lived token after an invalid upgrade",
  async (upgrade) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ access_token: "short", permissions: scopes }),
        )
        .mockResolvedValueOnce(Response.json(upgrade)),
    );
    await expect(
      instagram.exchangeCode(credentials, "code", "https://ypr.app/callback"),
    ).rejects.toThrow("instagram_longlived_token_required");
  },
);
it.each([
  { access_token: "short", permissions: scopes },
  { data: [{ access_token: "short", permissions: scopes.join(",") }] },
])(
  "accepts complete consent in either documented token envelope",
  async (grant) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(grant))
        .mockResolvedValueOnce(
          Response.json({ access_token: "long", expires_in: 5184000 }),
        ),
    );
    const tokens = await instagram.exchangeCode(
      credentials,
      "code",
      "https://ypr.app/callback",
    );
    expect(tokens).toMatchObject({
      accessToken: "long",
      refreshToken: "long",
      scope: scopes.join(","),
    });
  },
);
it.each([{}, { id: "account" }, { username: "creator" }])(
  "rejects an unidentified Instagram account",
  async (account) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(account)));
    await expect(instagram.fetchAccount("token")).rejects.toThrow(
      "instagram_account_required",
    );
  },
);
it("rejects an Instagram profile API failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
  );
  await expect(instagram.fetchAccount("token")).rejects.toThrow(
    "instagram_account_lookup_failed",
  );
});
it("uses Instagram's user_id and readable handle", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ user_id: "ig-user", id: "other", username: "creator" }),
      ),
  );
  await expect(instagram.fetchAccount("token")).resolves.toEqual({
    externalAccountId: "ig-user",
    handle: "@creator",
  });
});
