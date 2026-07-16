import { PLATFORMS } from "@/lib/publish/platforms";
import {
  expiryFrom,
  type Creds,
  type OAuthAccount,
  type OAuthProvider,
  type OAuthTokens,
} from "./provider";

// Instagram API with Instagram Login (no Facebook Page required). The account
// must be a Professional account (Business or Creator) to publish; a personal
// account can complete this OAuth but the publish call will 400.
const AUTHORIZE = "https://www.instagram.com/oauth/authorize";
const SHORT_TOKEN = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";

/** Instagram issues a 1-hour token from the code exchange, then a long-lived
 * (~60 day) token from a second call. There is no separate refresh token: you
 * refresh the long-lived token with itself, so we store it as both. */
export const instagram: OAuthProvider = {
  buildAuthUrl(creds: Creds, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: creds.id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: PLATFORMS.instagram.scopes.join(","),
      state,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  },

  async exchangeCode(
    creds: Creds,
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    const short = await fetch(SHORT_TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
    });
    if (!short.ok) throw new Error(`oauth_exchange_${short.status}`);
    const shortJson = (await short.json()) as {
      access_token?: string;
      permissions?: string[] | string;
    };
    if (!shortJson.access_token) throw new Error("oauth_no_access_token");

    // Upgrade the 1-hour token to a ~60-day long-lived token.
    const longUrl = new URL(`${GRAPH}/access_token`);
    longUrl.searchParams.set("grant_type", "ig_exchange_token");
    longUrl.searchParams.set("client_secret", creds.secret);
    longUrl.searchParams.set("access_token", shortJson.access_token);
    const long = await fetch(longUrl);
    if (!long.ok) throw new Error(`oauth_longlived_${long.status}`);
    const longJson = (await long.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    const token = longJson.access_token ?? shortJson.access_token;
    const scope = Array.isArray(shortJson.permissions)
      ? shortJson.permissions.join(",")
      : (shortJson.permissions ?? null);
    return {
      accessToken: token,
      // No distinct refresh token; the long-lived token refreshes itself.
      refreshToken: token,
      expiresAt: expiryFrom(longJson.expires_in),
      scope,
    };
  },

  async refreshAccessToken(
    _creds: Creds,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date | null;
  }> {
    const url = new URL(`${GRAPH}/refresh_access_token`);
    url.searchParams.set("grant_type", "ig_refresh_token");
    url.searchParams.set("access_token", refreshToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`oauth_refresh_${res.status}`);
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) throw new Error("oauth_refresh_no_token");
    return {
      accessToken: json.access_token,
      // The refreshed long-lived token replaces the old one as BOTH tokens;
      // there is no separate refresh token to keep.
      refreshToken: json.access_token,
      expiresAt: expiryFrom(json.expires_in),
    };
  },

  async fetchAccount(accessToken: string): Promise<OAuthAccount> {
    const url = new URL(`${GRAPH}/me`);
    url.searchParams.set("fields", "user_id,username");
    url.searchParams.set("access_token", accessToken);
    const res = await fetch(url);
    if (!res.ok) return { externalAccountId: null, handle: null };
    const json = (await res.json()) as {
      user_id?: string;
      id?: string;
      username?: string;
    };
    return {
      externalAccountId: json.user_id ?? json.id ?? null,
      handle: json.username ? `@${json.username}` : null,
    };
  },
};
