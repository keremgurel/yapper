import { and, asc, eq, lt } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { platformConnections } from "@/lib/db/schema";
import { updateAccessToken } from "@/lib/db/publish";
import {
  pruneYouTubeData,
  removeRejectedYouTubeConnection,
  YOUTUBE_DATA_MAX_AGE_MS,
} from "@/lib/db/youtube-data";
import { fetchAccount, refreshAccessToken } from "./oauth";
import { decryptToken } from "./tokens";

/** Validate even inactive users' grants. Oldest first so retries cannot starve
 * other accounts. Five parallel requests share a bounded part of daily cron. */
export async function maintainYouTubeData(deadlineAt: number) {
  const result = {
    checked: 0,
    removed: 0,
    pruned: 0,
    failed: 0,
    pending: false,
  };
  const due = new Date(Date.now() - 24 * 60 * 60_000);
  while (Date.now() + 11_000 < deadlineAt) {
    const rows = await getDb()
      .select()
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.platform, "youtube"),
          lt(platformConnections.updatedAt, due),
        ),
      )
      .orderBy(asc(platformConnections.updatedAt))
      .limit(5);
    if (!rows.length) break;
    await Promise.all(
      rows.map(async (row) => {
        try {
          if (row.status !== "active" || !row.refreshTokenEnc) {
            if (await removeRejectedYouTubeConnection(row.userId, row))
              result.removed++;
            return;
          }
          const token = await refreshAccessToken(
            "youtube",
            decryptToken(row.refreshTokenEnc),
          );
          const account = await fetchAccount("youtube", token.accessToken);
          await updateAccessToken(
            row.userId,
            "youtube",
            token.accessToken,
            token.expiresAt,
            token.refreshToken,
            row,
            account,
          );
          result.checked++;
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "oauth_refresh_invalid_grant"
          ) {
            if (await removeRejectedYouTubeConnection(row.userId, row))
              result.removed++;
          } else {
            result.failed++;
          }
        }
      }),
    );
    // Preserve transient failures for a later run without spinning on them.
    if (result.failed) break;
  }
  // Fail closed before the 30-day retention limit, even during an extended
  // provider outage or a growing verification backlog. Reconnect restores use.
  const stale = await getDb()
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.platform, "youtube"),
        lt(
          platformConnections.updatedAt,
          new Date(Date.now() - YOUTUBE_DATA_MAX_AGE_MS),
        ),
      ),
    );
  for (const row of stale) {
    if (await removeRejectedYouTubeConnection(row.userId, row))
      result.removed++;
  }
  result.pruned = await pruneYouTubeData();
  const remaining = await getDb()
    .select({ id: platformConnections.id })
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.platform, "youtube"),
        lt(platformConnections.updatedAt, due),
      ),
    )
    .limit(1);
  result.pending = remaining.length > 0;
  return result;
}
