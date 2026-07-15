import { and, eq } from "drizzle-orm";
import { encryptToken } from "@/lib/publish/tokens";
import { getDb } from "./client";
import {
  platformConnections,
  publishJobs,
  type PublishPlatform,
} from "./schema";

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
): Promise<void> {
  await getDb()
    .update(platformConnections)
    .set({
      accessTokenEnc: encryptToken(accessToken),
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

/** Open a publish job in the `uploading` state; returns its id to complete/fail. */
export async function createPublishJob(
  userId: string,
  input: {
    platform: PublishPlatform;
    mediaKey: string;
    title?: string | null;
    caption?: string | null;
    contentItemId?: string | null;
  },
): Promise<string> {
  const [row] = await getDb()
    .insert(publishJobs)
    .values({
      userId,
      platform: input.platform,
      mediaKey: input.mediaKey,
      status: "uploading",
      title: input.title ?? null,
      caption: input.caption ?? null,
      contentItemId: input.contentItemId ?? null,
    })
    .returning({ id: publishJobs.id });
  return row.id;
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
