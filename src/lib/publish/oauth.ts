import type { PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";
import { google } from "./oauth/google";
import { instagram } from "./oauth/instagram";
import {
  type Creds,
  type OAuthAccount,
  type OAuthProvider,
  type OAuthTokens,
} from "./oauth/provider";
import { tiktok } from "./oauth/tiktok";

export type { OAuthAccount, OAuthTokens } from "./oauth/provider";

/**
 * OAuth 2.0 authorization-code flow for the publish platforms. Each platform's
 * dialect lives in its own provider module (oauth/google, oauth/tiktok,
 * oauth/instagram); this file resolves credentials from the registry and
 * dispatches to one, so the connect/callback routes and the token-refresh
 * orchestrator stay platform-agnostic.
 */
const PROVIDERS: Record<PublishPlatform, OAuthProvider> = {
  youtube: google,
  tiktok,
  instagram,
};

function provider(platform: PublishPlatform): OAuthProvider {
  return PROVIDERS[platform];
}

function creds(platform: PublishPlatform): Creds {
  const { clientId, clientSecret } = PLATFORMS[platform].env;
  const id = process.env[clientId];
  const secret = process.env[clientSecret];
  if (!id || !secret) throw new Error(`${platform}_not_configured`);
  return { id, secret };
}

export function buildAuthUrl(
  platform: PublishPlatform,
  redirectUri: string,
  state: string,
): string {
  return provider(platform).buildAuthUrl(creds(platform), redirectUri, state);
}

export function exchangeCode(
  platform: PublishPlatform,
  code: string,
  redirectUri: string,
): Promise<OAuthTokens> {
  return provider(platform).exchangeCode(creds(platform), code, redirectUri);
}

export function refreshAccessToken(
  platform: PublishPlatform,
  refreshToken: string,
): Promise<{
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date | null;
}> {
  return provider(platform).refreshAccessToken(creds(platform), refreshToken);
}

export function fetchAccount(
  platform: PublishPlatform,
  accessToken: string,
): Promise<OAuthAccount> {
  return provider(platform).fetchAccount(accessToken);
}
