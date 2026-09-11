import { afterEach, describe, expect, it, vi } from "vitest";
import { facebook } from "./facebook";
const creds = { id: "app", secret: "secret" };
const redirect = "https://ypr.app/api/publish/callback/facebook";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Facebook OAuth", () => {
  it("preserves the CSRF state and requests Page publishing access", () => {
    vi.stubEnv("FACEBOOK_LOGIN_CONFIG_ID", "config-1");
    const url = new URL(facebook.buildAuthUrl(creds, redirect, "csrf-nonce"));
    expect(url.searchParams.get("state")).toBe("csrf-nonce");
    expect(url.searchParams.get("redirect_uri")).toBe(redirect);
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
    ]);
    expect(url.searchParams.get("config_id")).toBe("config-1");
  });
  it("rejects partial permissions rather than recording nonexistent publishing access", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ access_token: "short", expires_in: 3600 }),
        )
        .mockResolvedValueOnce(
          Response.json({ access_token: "long", expires_in: 5_000_000 }),
        )
        .mockResolvedValueOnce(
          Response.json({
            data: [
              { permission: "pages_show_list", status: "granted" },
              { permission: "pages_manage_posts", status: "declined" },
            ],
          }),
        ),
    );
    await expect(
      facebook.exchangeCode(creds, "code", redirect),
    ).rejects.toThrow("facebook_permissions_required");
  });
  it("never chooses a Page implicitly", async () => {
    expect(await facebook.fetchAccount("token")).toEqual({
      externalAccountId: null,
      handle: "Choose a Facebook Page",
    });
  });
});
