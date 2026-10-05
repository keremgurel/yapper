import {
  getConnectionRow,
  markConnectionExpired,
  updateAccessToken,
} from "@/lib/db/publish";
import { isRejectedLogin } from "@/lib/publish/rejected-login";
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
  expectedAccountId?: string,
): Promise<string> {
  const row = await getConnectionRow(userId, platform);
  if (!row) throw new NoConnectionError(`${platform}_not_connected`);
  // A login the platform already refused stays refused until the creator
  // reconnects; asking again would only fail again.
  if (row.status !== "active")
    throw new NoConnectionError(`${platform}_reauth_required`);
  if (
    expectedAccountId &&
    (row.externalAccountId !== expectedAccountId || row.status !== "active")
  ) {
    throw new NoConnectionError(`${platform}_account_changed`);
  }

  if (platform === "facebook" && row.externalAccountId && !row.expiresAt)
    return decryptToken(row.accessTokenEnc);

  const stillValid =
    row.expiresAt && row.expiresAt.getTime() - SKEW_MS > Date.now();
  if (stillValid) return decryptToken(row.accessTokenEnc);

  if (!row.refreshTokenEnc || platform === "facebook") {
    // Expired and nothing to refresh with: the user must reconnect.
    throw new NoConnectionError(`${platform}_reauth_required`);
  }
  const refreshToken = decryptToken(row.refreshTokenEnc);
  let fresh: Awaited<ReturnType<typeof refreshAccessToken>>;
  try {
    fresh = await refreshAccessToken(platform, refreshToken);
  } catch (error) {
    if (!isRejectedLogin(error)) throw error;
    await markConnectionExpired(userId, platform);
    throw new NoConnectionError(`${platform}_reauth_required`);
  }
  const saved = await updateAccessToken(
    userId,
    platform,
    fresh.accessToken,
    fresh.expiresAt,
    // Instagram rotates its token on refresh; persist the new one so the next
    // refresh does not reach for the expired original.
    fresh.refreshToken,
    { id: row.id, accessTokenEnc: row.accessTokenEnc },
  );
  if (!saved) throw new NoConnectionError(`${platform}_connection_changed`);
  return fresh.accessToken;
}
