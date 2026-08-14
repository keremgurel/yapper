import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { encryptToken } from "@/lib/publish/tokens";
import { getDb } from "./client";
import {
  platformConnections,
  publishJobs,
  r2Objects,
  type PublishPlatform,
} from "./schema";
import {
  lockMediaReferenceWithinTx,
  lockStorageUserWithinTx,
} from "./storage-accounting";

/** The OAuth result to persist for a (user, platform), tokens still plaintext. */
export interface ConnectionInput {
  accessToken: string;
  refreshToken?: string | null;
  scope?: string | null;
  expiresAt?: Date | null;
  externalAccountId?: string | null;
  handle?: string | null;
}

/** A connection as the UI shows it: which account, live or not — never tokens. */
export interface ConnectionSummary {
  platform: PublishPlatform;
  handle: string | null;
  externalAccountId: string | null;
  status: string;
  updatedAt: Date;
}

/**
 * Store (or refresh) the link between a user and a platform. Tokens are
 * encrypted here so no caller handles ciphertext. At most one row per
 * (user, platform): reconnecting overwrites in place and clears any prior
 * revoked/expired status back to active.
 */
export async function upsertConnection(
  userId: string,
  platform: PublishPlatform,
  input: ConnectionInput,
): Promise<void> {
  const encrypted = {
    accessTokenEnc: encryptToken(input.accessToken),
    refreshTokenEnc: input.refreshToken
      ? encryptToken(input.refreshToken)
      : null,
    scope: input.scope ?? null,
    expiresAt: input.expiresAt ?? null,
    externalAccountId: input.externalAccountId ?? null,
    handle: input.handle ?? null,
    status: "active" as const,
    updatedAt: new Date(),
  };
  await getDb()
    .insert(platformConnections)
    .values({ userId, platform, ...encrypted })
    .onConflictDoUpdate({
      target: [platformConnections.userId, platformConnections.platform],
      set: encrypted,
    });
}

/** The full stored row for one connection, tokens still encrypted. Used by the
 * token-refresh orchestrator; never hand this to the client. */
export async function getConnectionRow(
  userId: string,
  platform: PublishPlatform,
) {
  const [row] = await getDb()
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.userId, userId),
        eq(platformConnections.platform, platform),
      ),
    );
  return row ?? null;
}

/** Persist a refreshed access token (the refresh token is unchanged). */
export async function updateAccessToken(
  userId: string,
  platform: PublishPlatform,
  accessToken: string,
  expiresAt: Date | null,
  // Persisted only when the provider rotated its refresh token (e.g. Instagram's
  // self-refreshing long-lived token); omitted keeps the stored refresh token.
  newRefreshToken?: string | null,
): Promise<void> {
  await getDb()
    .update(platformConnections)
    .set({
      accessTokenEnc: encryptToken(accessToken),
      ...(newRefreshToken
        ? { refreshTokenEnc: encryptToken(newRefreshToken) }
        : {}),
      expiresAt,
      status: "active",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(platformConnections.userId, userId),
        eq(platformConnections.platform, platform),
      ),
    );
}

/** The user's connections for display (no tokens leave the DB layer). */
export async function listConnections(
  userId: string,
): Promise<ConnectionSummary[]> {
  return getDb()
    .select({
      platform: platformConnections.platform,
      handle: platformConnections.handle,
      externalAccountId: platformConnections.externalAccountId,
      status: platformConnections.status,
      updatedAt: platformConnections.updatedAt,
    })
    .from(platformConnections)
    .where(eq(platformConnections.userId, userId));
}

export type PublishJobClaim =
  | { kind: "created"; jobId: string }
  | {
      kind: "existing";
      jobId: string;
      status: (typeof publishJobs.$inferSelect)["status"];
      externalPostId: string | null;
      externalUrl: string | null;
    }
  | { kind: "unavailable" };

export async function findPublishJobClaim(
  userId: string,
  platform: PublishPlatform,
  idempotencyKey: string,
): Promise<Extract<PublishJobClaim, { kind: "existing" }> | null> {
  const [row] = await getDb()
    .select({
      id: publishJobs.id,
      status: publishJobs.status,
      externalPostId: publishJobs.externalPostId,
      externalUrl: publishJobs.externalUrl,
    })
    .from(publishJobs)
    .where(
      and(
        eq(publishJobs.userId, userId),
        eq(publishJobs.platform, platform),
        eq(publishJobs.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  return row
    ? {
        kind: "existing",
        jobId: row.id,
        status: row.status,
        externalPostId: row.externalPostId,
        externalUrl: row.externalUrl,
      }
    : null;
}

/**
 * Atomically admit one irreversible platform operation. The per-user storage
 * lock serializes competing requests, so the same browser intent can create at
 * most one job even before the database unique index is consulted. A repeated
 * request receives the durable prior state and must never call the provider.
 */
export async function claimPublishJob(
  userId: string,
  input: {
    platform: PublishPlatform;
    mediaKey: string;
    idempotencyKey: string;
    title?: string | null;
    caption?: string | null;
    contentItemId?: string | null;
  },
): Promise<PublishJobClaim> {
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);

    const [existing] = await tx
      .select({
        id: publishJobs.id,
        status: publishJobs.status,
        externalPostId: publishJobs.externalPostId,
        externalUrl: publishJobs.externalUrl,
      })
      .from(publishJobs)
      .where(
        and(
          eq(publishJobs.userId, userId),
          eq(publishJobs.platform, input.platform),
          eq(publishJobs.idempotencyKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing) {
      return {
        kind: "existing",
        jobId: existing.id,
        status: existing.status,
        externalPostId: existing.externalPostId,
        externalUrl: existing.externalUrl,
      };
    }

    await lockMediaReferenceWithinTx(tx, userId, input.mediaKey);
    const [object] = await tx
      .select({ state: r2Objects.state })
      .from(r2Objects)
      .where(
        and(
          eq(r2Objects.mediaKey, input.mediaKey),
          eq(r2Objects.userId, userId),
        ),
      )
      .for("update")
      .limit(1);
    if (!object || !["active", "delete_pending"].includes(object.state)) {
      return { kind: "unavailable" };
    }

    const [row] = await tx
      .insert(publishJobs)
      .values({
        userId,
        platform: input.platform,
        mediaKey: input.mediaKey,
        idempotencyKey: input.idempotencyKey,
        status: "uploading",
        title: input.title ?? null,
        caption: input.caption ?? null,
        contentItemId: input.contentItemId ?? null,
      })
      .returning({ id: publishJobs.id });
    return { kind: "created", jobId: row.id };
  });
}

export async function completePublishJob(
  id: string,
  result: { externalPostId: string; externalUrl: string },
): Promise<void> {
  await getDb()
    .update(publishJobs)
    .set({
      status: "published",
      externalPostId: result.externalPostId,
      externalUrl: result.externalUrl,
      updatedAt: new Date(),
    })
    .where(eq(publishJobs.id, id));
}

export async function failPublishJob(id: string, error: string): Promise<void> {
  await getDb()
    .update(publishJobs)
    .set({
      status: "failed",
      error: error.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(publishJobs.id, id));
}

/** Record why an irreversible provider attempt remains unresolved without
 * making it retryable. The uploading status preserves the idempotency claim;
 * the diagnostic gives reconciliation work a durable selector. */
export async function notePublishJobPending(
  id: string,
  error: string,
): Promise<void> {
  await getDb()
    .update(publishJobs)
    .set({ error: error.slice(0, 500), updatedAt: new Date() })
    .where(eq(publishJobs.id, id));
}

/**
 * Recover the original R2 source for platform posts Yapper published earlier.
 * Platform list APIs expose metadata and thumbnails, not the uploaded bytes;
 * keeping this association is what makes an old YouTube, TikTok, or Instagram
 * post reusable in Poster without downloading a degraded platform transcode.
 */
export async function archivedMediaKeysForPosts(
  userId: string,
  platform: PublishPlatform,
  externalPostIds: string[],
): Promise<Map<string, string>> {
  if (externalPostIds.length === 0) return new Map();
  const rows = await getDb()
    .select({
      externalPostId: publishJobs.externalPostId,
      mediaKey: publishJobs.mediaKey,
    })
    .from(publishJobs)
    .where(
      and(
        eq(publishJobs.userId, userId),
        eq(publishJobs.platform, platform),
        eq(publishJobs.status, "published"),
        isNotNull(publishJobs.externalPostId),
        inArray(publishJobs.externalPostId, externalPostIds),
      ),
    )
    .orderBy(desc(publishJobs.updatedAt));

  const result = new Map<string, string>();
  for (const row of rows) {
    if (row.externalPostId && !result.has(row.externalPostId)) {
      result.set(row.externalPostId, row.mediaKey);
    }
  }
  return result;
}

/** Remove a connection (disconnect). Returns whether a row was deleted. */
export async function deleteConnection(
  userId: string,
  platform: PublishPlatform,
): Promise<boolean> {
  const rows = await getDb()
    .delete(platformConnections)
    .where(
      and(
        eq(platformConnections.userId, userId),
        eq(platformConnections.platform, platform),
      ),
    )
    .returning({ platform: platformConnections.platform });
  return rows.length > 0;
}
