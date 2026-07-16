/**
 * Each publish platform speaks its own dialect of OAuth 2.0 (Google wants
 * access_type + prompt, TikTok renames client_id to client_key, Instagram does
 * a two-step short-then-long-lived token). Rather than branch a single file to
 * death, each provider implements this small interface in its own module and
 * the dispatcher in `../oauth.ts` selects one by platform.
 */
export interface Creds {
  id: string;
  secret: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

export interface OAuthAccount {
  externalAccountId: string | null;
  handle: string | null;
}

export interface OAuthProvider {
  /** The consent URL to send the user to. `state` is our CSRF nonce. */
  buildAuthUrl(creds: Creds, redirectUri: string, state: string): string;
  /** Exchange the authorization code for tokens. redirectUri must match the
   * one used in buildAuthUrl (the provider checks it). */
  exchangeCode(
    creds: Creds,
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokens>;
  /**
   * Trade a refresh token (or long-lived token) for a fresh access token.
   * `refreshToken` comes back only when the provider ROTATES it (Instagram's
   * long-lived token refreshes itself, so the new token replaces the old one);
   * providers with a stable refresh token omit it and the stored one is kept.
   */
  refreshAccessToken(
    creds: Creds,
    refreshToken: string,
  ): Promise<{
    accessToken: string;
    refreshToken?: string | null;
    expiresAt: Date | null;
  }>;
  /** Identify the connected account for display. Best-effort: a failure here
   * must not fail the connection, so it returns nulls. */
  fetchAccount(accessToken: string): Promise<OAuthAccount>;
}

/** Seconds-from-now to an absolute expiry, or null when the provider omits it. */
export function expiryFrom(expiresInSec: number | undefined): Date | null {
  return expiresInSec ? new Date(Date.now() + expiresInSec * 1000) : null;
}
