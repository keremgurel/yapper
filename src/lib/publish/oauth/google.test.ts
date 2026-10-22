import { afterEach, describe, expect, it, vi } from "vitest";
import { google } from "./google";
import { PLATFORMS } from "../platforms";

const creds = { id: "client", secret: "secret" };
const redirect = "https://ypr.app/api/publish/callback/youtube";
const grant = {
  access_token: "access",
  refresh_token: "refresh",
  expires_in: 3600,
  scope: PLATFORMS.youtube.scopes.join(" "),
};
afterEach(() => vi.unstubAllGlobals());

describe("YouTube connection validation", () => {
  it.each([
    undefined,
    "",
    PLATFORMS.youtube.scopes[0],
    PLATFORMS.youtube.scopes[1],
    "openid email",
  ])("rejects an incomplete grant (%s)", async (scope) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ...grant, scope })),
    );
    await expect(google.exchangeCode(creds, "code", redirect)).rejects.toThrow(
      "youtube_permissions_required",
    );
  });

  it("keeps both permissions and durable credentials from a full grant", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...grant, scope: `openid  ${grant.scope}` }),
        ),
    );
    const result = await google.exchangeCode(creds, "code", redirect);
    expect(result.accessToken).toBe("access");
    expect(result.refreshToken).toBe("refresh");
    expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects access that would silently expire after an hour", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...grant, refresh_token: undefined }),
        ),
    );
    await expect(google.exchangeCode(creds, "code", redirect)).rejects.toThrow(
      "youtube_offline_access_required",
    );
  });

  it("does not turn an API failure into a connected unidentified channel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
    );
    await expect(google.fetchAccount("access")).rejects.toThrow(
      "youtube_channel_lookup_failed",
    );
  });

  it.each([{}, { items: [] }, { items: [{ snippet: { title: "No ID" } }] }])(
    "rejects a Google account without a usable YouTube channel",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
      await expect(google.fetchAccount("access")).rejects.toThrow(
        "youtube_channel_required",
      );
    },
  );

  it("uses the authenticated channel identity", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({
          items: [
            {
              id: "channel-1",
              snippet: { title: "Channel", customUrl: "@channel" },
            },
          ],
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect(await google.fetchAccount("access")).toEqual({
      externalAccountId: "channel-1",
      handle: "@channel",
    });
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("mine=true"), {
      headers: { Authorization: "Bearer access" },
    });
  });
});
