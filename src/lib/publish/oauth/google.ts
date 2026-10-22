import { PLATFORMS } from "@/lib/publish/platforms";
import {
  expiryFrom,
  type Creds,
  type OAuthAccount,
  type OAuthProvider,
  type OAuthTokens,
} from "./provider";

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";

/** Google / YouTube (Data API v3). Standard authorization-code flow; the only
 * quirk is access_type=offline + prompt=consent so a refresh token comes back
 * every time, even on a reconnect. */
export const google: OAuthProvider = {
  buildAuthUrl(creds: Creds, redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: creds.id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: PLATFORMS.youtube.scopes.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
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
        client_id: creds.id,
        client_secret: creds.secret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
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
    // Google consent is granular: a successful exchange does not mean both
    // permissions were granted. Never replace a working connection with one
    // that cannot read the channel library or upload the reviewed video.
    const granted = new Set(json.scope?.split(/\s+/).filter(Boolean));
    if (!PLATFORMS.youtube.scopes.every((scope) => granted.has(scope))) {
      throw new Error("youtube_permissions_required");
    }
    // Connections must survive the first access token's expiration. With
    // offline access and prompt=consent, a successful reconnect supplies this.
    if (!json.refresh_token) throw new Error("youtube_offline_access_required");
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
  ): Promise<{ accessToken: string; expiresAt: Date | null }> {
    const res = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) throw new Error(`oauth_refresh_${res.status}`);
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) throw new Error("oauth_refresh_no_token");
    return {
      accessToken: json.access_token,
      expiresAt: expiryFrom(json.expires_in),
    };
  },

  async fetchAccount(accessToken: string): Promise<OAuthAccount> {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error("youtube_channel_lookup_failed");
    const json = (await res.json()) as {
      items?: {
        id?: string;
        snippet?: { title?: string; customUrl?: string };
      }[];
    };
    const ch = json.items?.[0];
    if (!ch?.id) throw new Error("youtube_channel_required");
    return {
      externalAccountId: ch?.id ?? null,
      handle: ch?.snippet?.customUrl ?? ch?.snippet?.title ?? null,
    };
  },
};
