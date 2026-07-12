import { getConnectionRow, updateAccessToken } from "@/lib/db/publish";
import type { PublishPlatform } from "@/lib/db/schema";
import { refreshAccessToken } from "@/lib/publish/oauth";
import { decryptToken } from "@/lib/publish/tokens";

/** Access tokens are refreshed this many ms before they actually expire, so a
 * long upload never starts on a token that dies mid-flight. */
const SKEW_MS = 60_000;

export class NoConnectionError extends Error {}

/**
 * A valid access token for (user, platform), refreshing and persisting a new one
 * when the stored one is expired or about to be. The single place the rest of
 * the publish code gets a token, so no caller ever touches ciphertext or expiry.
 */
export async function getFreshAccessToken(
  userId: string,
  platform: PublishPlatform,
): Promise<string> {
  const row = await getConnectionRow(userId, platform);
  if (!row) throw new NoConnectionError(`${platform}_not_connected`);

  const stillValid =
    row.expiresAt && row.expiresAt.getTime() - SKEW_MS > Date.now();
  if (stillValid) return decryptToken(row.accessTokenEnc);

  if (!row.refreshTokenEnc) {
    // Expired and nothing to refresh with: the user must reconnect.
    throw new NoConnectionError(`${platform}_reauth_required`);
  }
  const refreshToken = decryptToken(row.refreshTokenEnc);
  const fresh = await refreshAccessToken(platform, refreshToken);
  await updateAccessToken(userId, platform, fresh.accessToken, fresh.expiresAt);
  return fresh.accessToken;
}
