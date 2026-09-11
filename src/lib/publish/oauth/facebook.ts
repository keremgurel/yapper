import { fetchBoundedJson } from "@/lib/http/outbound";
import { FACEBOOK_GRAPH, facebookRequest } from "../facebook-api";
import { PLATFORMS } from "../platforms";
import { expiryFrom, type OAuthProvider } from "./provider";

export const facebook: OAuthProvider = {
  buildAuthUrl(creds, redirectUri, state) {
    const query = new URLSearchParams({
      client_id: creds.id,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: PLATFORMS.facebook.scopes.join(","),
    });
    if (process.env.FACEBOOK_LOGIN_CONFIG_ID)
      query.set("config_id", process.env.FACEBOOK_LOGIN_CONFIG_ID);
    return `https://www.facebook.com/v26.0/dialog/oauth?${query}`;
  },
  async exchangeCode(creds, code, redirectUri) {
    async function exchange(body: URLSearchParams) {
      const { response, data } = await fetchBoundedJson<{
        access_token?: string;
        expires_in?: number;
        error?: unknown;
      }>(
        `${FACEBOOK_GRAPH}/oauth/access_token`,
        { method: "POST", body },
        { timeoutMs: 20_000, maxBytes: 64 * 1024 },
      );
      if (!response.ok || data.error || !data.access_token)
        throw new Error("facebook_oauth_exchange_failed");
      return { token: data.access_token, expires: data.expires_in };
    }
    const short = await exchange(
      new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        redirect_uri: redirectUri,
        code,
      }),
    );
    const long = await exchange(
      new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        grant_type: "fb_exchange_token",
        fb_exchange_token: short.token,
      }),
    );
    const permissions = await facebookRequest<{
      data?: { permission: string; status: string }[];
    }>("me/permissions", long.token);
    const granted = new Set(
      permissions.data
        ?.filter((p) => p.status === "granted")
        .map((p) => p.permission),
    );
    if (PLATFORMS.facebook.scopes.some((scope) => !granted.has(scope)))
      throw new Error("facebook_permissions_required");
    // A Facebook user token is retained only to list/select authorized Pages.
    // No Page is selected implicitly, even when the user manages only one.
    return {
      accessToken: long.token,
      refreshToken: long.token,
      expiresAt: expiryFrom(long.expires),
      scope: [...granted].join(","),
    };
  },
  async fetchAccount() {
    return { externalAccountId: null, handle: "Choose a Facebook Page" };
  },
  async refreshAccessToken() {
    throw new Error("facebook_reauth_required");
  },
};
