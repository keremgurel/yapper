import type { PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";

/**
 * OAuth 2.0 authorization-code flow for the publish platforms. YouTube (Google)
 * is wired up first; TikTok and Instagram slot in by adding their endpoints and
 * an `fetchAccount` branch. Scopes and env-var names come from the platform
 * registry so there is one source of truth.
 */
interface OAuthEndpoints {
  authorize: string;
  token: string;
}

const ENDPOINTS: Partial<Record<PublishPlatform, OAuthEndpoints>> = {
  youtube: {
    authorize: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
  },
};

function endpoints(platform: PublishPlatform): OAuthEndpoints {
  const ep = ENDPOINTS[platform];
  if (!ep) throw new Error(`oauth_unsupported_${platform}`);
  return ep;
}

function creds(platform: PublishPlatform): { id: string; secret: string } {
  const { clientId, clientSecret } = PLATFORMS[platform].env;
  const id = process.env[clientId];
  const secret = process.env[clientSecret];
  if (!id || !secret) throw new Error(`${platform}_not_configured`);
  return { id, secret };
}

/** The consent URL to send the user to. `state` is our CSRF nonce. */
export function buildAuthUrl(
  platform: PublishPlatform,
  redirectUri: string,
  state: string,
): string {
  const { id } = creds(platform);
  const params = new URLSearchParams({
    client_id: id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: PLATFORMS[platform].scopes.join(" "),
    // offline + consent so Google returns a refresh token every time, even on a
    // reconnect (it otherwise omits it after the first grant).
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${endpoints(platform).authorize}?${params.toString()}`;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

/** Exchange the authorization code for tokens. redirectUri must match the one
 * used in `buildAuthUrl` (the provider checks it). */
export async function exchangeCode(
  platform: PublishPlatform,
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  const { id, secret } = creds(platform);
  const res = await fetch(endpoints(platform).token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id,
      client_secret: secret,
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
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000)
      : null,
    scope: json.scope ?? null,
  };
}

export interface OAuthAccount {
  externalAccountId: string | null;
  handle: string | null;
}

/** Identify the connected account for display (channel/handle). Best-effort:
 * a failure here must not fail the connection, so it returns nulls. */
export async function fetchAccount(
  platform: PublishPlatform,
  accessToken: string,
): Promise<OAuthAccount> {
  if (platform === "youtube") {
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) return { externalAccountId: null, handle: null };
    const json = (await res.json()) as {
      items?: {
        id?: string;
        snippet?: { title?: string; customUrl?: string };
      }[];
    };
    const ch = json.items?.[0];
    return {
      externalAccountId: ch?.id ?? null,
      handle: ch?.snippet?.customUrl ?? ch?.snippet?.title ?? null,
    };
  }
  return { externalAccountId: null, handle: null };
}
