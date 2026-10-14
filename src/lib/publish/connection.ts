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

/** How long a refused refresh waits for a concurrent one to finish saving. */
export const RACE_SETTLE_MS = 750;

/**
 * The access token another request saved after `staleTokenEnc` was read, or
 * null when nothing changed. Looks twice, because the request that won the
 * refresh may still be writing when the loser's refusal comes back.
 */
async function loginSavedMeanwhile(
  userId: string,
  platform: PublishPlatform,
  staleTokenEnc: string,
): Promise<string | null> {
  for (const wait of [0, RACE_SETTLE_MS]) {
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    const latest = await getConnectionRow(userId, platform);
    if (latest?.status === "active" && latest.accessTokenEnc !== staleTokenEnc)
      return decryptToken(latest.accessTokenEnc);
  }
  return null;
}

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
    // TikTok and Instagram issue a new refresh token on every refresh, so two
    // requests refreshing at once leave the slower one holding a spent token.
    // That refusal is not a revoked login: use what the faster one saved.
    const saved = await loginSavedMeanwhile(
      userId,
      platform,
      row.accessTokenEnc,
    );
    if (saved) return saved;
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
