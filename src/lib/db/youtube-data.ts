import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb, type DbTx } from "./client";
import {
  platformConnections,
  publishJobs,
  publishingSchedules,
} from "./schema";
import { lockStorageUserWithinTx } from "./storage-accounting";

export const YOUTUBE_DATA_MAX_AGE_MS = 25 * 24 * 60 * 60_000;

/** Retain the idempotency claim and creator-owned source/copy, never provider data.
 * The tombstone also prevents a late upload response from restoring deleted IDs. */
export async function purgeYouTubeDataWithinTx(
  tx: DbTx,
  userId: string,
  before?: Date,
) {
  await tx
    .update(publishJobs)
    .set({
      externalPostId: null,
      externalUrl: null,
      providerState: { dataDeleted: true },
      error: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publishJobs.userId, userId),
        eq(publishJobs.platform, "youtube"),
        sql`coalesce(${publishJobs.providerState}->>'dataDeleted', 'false') <> 'true'`,
        before ? lt(publishJobs.createdAt, before) : undefined,
      ),
    );
  await tx
    .update(publishingSchedules)
    .set({
      externalAccountId: "",
      accountLabel: "YouTube",
      externalUrl: null,
      leaseToken: null,
      leaseExpiresAt: null,
      error: null,
      status: sql`case when ${publishingSchedules.status} in ('scheduled','running','needs_attention','failed') then 'cancelled' else ${publishingSchedules.status} end`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publishingSchedules.userId, userId),
        eq(publishingSchedules.platform, "youtube"),
        before
          ? and(
              lt(publishingSchedules.updatedAt, before),
              inArray(publishingSchedules.status, [
                "published",
                "draft",
                "cancelled",
              ]),
            )
          : undefined,
      ),
    );
}

/** CAS protects a reconnect from a refusal returned by an older request. */
export async function removeRejectedYouTubeConnection(
  userId: string,
  expected: { id: string; accessTokenEnc: string },
): Promise<boolean> {
  return getDb().transaction(async (tx) => {
    await lockStorageUserWithinTx(tx, userId);
    const rows = await tx
      .delete(platformConnections)
      .where(
        and(
          eq(platformConnections.userId, userId),
          eq(platformConnections.platform, "youtube"),
          eq(platformConnections.id, expected.id),
          eq(platformConnections.accessTokenEnc, expected.accessTokenEnc),
        ),
      )
      .returning({ id: platformConnections.id });
    if (!rows.length) return false;
    await purgeYouTubeDataWithinTx(tx, userId);
    return true;
  });
}

/** Daily sweep includes historical rows whose connection was already removed. */
export async function pruneYouTubeData(): Promise<number> {
  const cutoff = new Date(Date.now() - YOUTUBE_DATA_MAX_AGE_MS);
  // Provider IDs are disposable; creator files and captions are not. An SQL
  // sweep avoids a per-account backlog for old metadata or historical orphans.
  const result = await getDb().execute(sql`
    update ${publishJobs} j set external_post_id = null, external_url = null,
      provider_state = '{"dataDeleted":true}'::jsonb, error = null, updated_at = now()
    where j.platform = 'youtube'
      and coalesce(j.provider_state->>'dataDeleted', 'false') <> 'true'
      and (j.created_at < ${cutoff} or not exists (
        select 1 from ${platformConnections} c where c.user_id = j.user_id
          and c.platform = 'youtube' and c.status = 'active'))`);
  await getDb().execute(sql`
    update ${publishingSchedules} s set external_account_id = '', account_label = 'YouTube',
      external_url = null, lease_token = null, lease_expires_at = null, error = null,
      status = case when s.status in ('scheduled','running','needs_attention','failed') then 'cancelled' else s.status end,
      updated_at = now()
    where s.platform = 'youtube' and (s.external_account_id <> '' or s.external_url is not null)
      and ((s.updated_at < ${cutoff} and s.status in ('published','draft','cancelled')) or not exists (
        select 1 from ${platformConnections} c where c.user_id = s.user_id
          and c.platform = 'youtube' and c.status = 'active'))`);
  return result.rowCount ?? 0;
}
