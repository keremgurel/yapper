import { PLATFORMS } from "@/lib/publish/platforms";
import {
  expiryFrom,
  type Creds,
  type OAuthAccount,
  type OAuthProvider,
  type OAuthTokens,
} from "./provider";

// TikTok v2 login kit. Two things differ from the textbook flow: the client id
// is passed as `client_key`, and scopes are comma-separated. The token endpoint
// otherwise behaves like a normal authorization-code exchange.
const AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";

export const tiktok: OAuthProvider = {
  buildAuthUrl(creds: Creds, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_key: creds.id,
      response_type: "code",
      scope: PLATFORMS.tiktok.scopes.join(","),
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTHORIZE}?${params.toString()}`;
  },

  async exchangeCode(
    creds: Creds,
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens> {
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: creds.id,
        client_secret: creds.secret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) throw new Error(`oauth_exchange_${res.status}`);
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };
    if (!json.access_token) throw new Error("oauth_no_access_token");
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: expiryFrom(json.expires_in),
      scope: json.scope ?? null,
    };
  },

  async refreshAccessToken(
    creds: Creds,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date | null;
  }> {
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: creds.id,
        client_secret: creds.secret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`oauth_refresh_${res.status}`);
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) throw new Error("oauth_refresh_no_token");
    return {
      accessToken: json.access_token,
      // TikTok rotates the refresh token on every refresh; persist the new one
      // or the connection dies ~365 days after the ORIGINAL auth regardless.
      refreshToken: json.refresh_token ?? null,
      expiresAt: expiryFrom(json.expires_in),
    };
  },

  async fetchAccount(accessToken: string): Promise<OAuthAccount> {
    const res = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return { externalAccountId: null, handle: null };
    const json = (await res.json()) as {
      data?: { user?: { open_id?: string; display_name?: string } };
    };
    const user = json.data?.user;
    return {
      externalAccountId: user?.open_id ?? null,
      handle: user?.display_name ?? null,
    };
  },
};
