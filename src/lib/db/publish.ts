import { and, eq } from "drizzle-orm";
import { encryptToken } from "@/lib/publish/tokens";
import { getDb } from "./client";
import { platformConnections, type PublishPlatform } from "./schema";

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
