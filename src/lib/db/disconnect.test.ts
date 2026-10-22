import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "./schema";
import { deleteConnection } from "./publish";
const refreshAccessToken = vi.hoisted(() => vi.fn());
vi.mock("@/lib/publish/oauth", () => ({
  refreshAccessToken,
  fetchAccount: vi.fn(async () => ({
    externalAccountId: "channel",
    handle: "Fresh name",
  })),
}));
vi.mock("@/lib/publish/tokens", () => ({
  decryptToken: (value: string) => value,
  encryptToken: (value: string) => value,
}));
const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30000);
beforeEach(async () => {
  refreshAccessToken.mockReset();
  await client.exec("TRUNCATE users CASCADE");
  await db.insert(schema.users).values([{ id: "owner" }, { id: "other" }]);
  await db.insert(schema.platformConnections).values([
    {
      userId: "owner",
      platform: "youtube",
      accessTokenEnc: "access",
      refreshTokenEnc: "refresh",
    },
    { userId: "other", platform: "youtube", accessTokenEnc: "other-token" },
    { userId: "owner", platform: "instagram", accessTokenEnc: "ig-token" },
  ]);
});
afterAll(() => client.close());
it("keeps the retry credential if revocation fails", async () => {
  await expect(
    deleteConnection("owner", "youtube", async () => {
      throw new Error("provider-unavailable");
    }),
  ).rejects.toThrow("provider-unavailable");
  const rows = await db.select().from(schema.platformConnections);
  expect(rows).toHaveLength(3);
  expect(
    rows.find((r) => r.userId === "owner" && r.platform === "youtube")
      ?.refreshTokenEnc,
  ).toBe("refresh");
});
it("revokes before deleting only the caller's selected connection", async () => {
  const revoke = vi.fn(async (row) => {
    expect(row.refreshTokenEnc).toBe("refresh");
  });
  expect(await deleteConnection("owner", "youtube", revoke)).toBe(true);
  expect(revoke).toHaveBeenCalledOnce();
  const rows = await db.select().from(schema.platformConnections);
  expect(rows).toHaveLength(2);
  expect(rows.map((r) => `${r.userId}:${r.platform}`).sort()).toEqual([
    "other:youtube",
    "owner:instagram",
  ]);
  expect(await deleteConnection("owner", "youtube", revoke)).toBe(false);
  expect(revoke).toHaveBeenCalledOnce();
});

it("erases only provider data and prevents late upload completion from restoring it", async () => {
  const { completePublishJob, recordProviderPublishId } =
    await import("./publish");
  const [job] = await db
    .insert(schema.publishJobs)
    .values({
      userId: "owner",
      platform: "youtube",
      mediaKey: "original.mp4",
      title: "My title",
      caption: "My caption",
      idempotencyKey: "same-intent",
      status: "uploading",
      externalPostId: "provider-id",
      externalUrl: "https://youtube.test/video",
      providerState: { accountId: "channel-id", publishId: "provider-id" },
    })
    .returning();
  await deleteConnection("owner", "youtube");
  await recordProviderPublishId(job.id, "late-id", { accountId: "channel-id" });
  await completePublishJob(job.id, {
    externalPostId: "late-id",
    externalUrl: "https://youtube.test/late",
  });
  const [saved] = await db.select().from(schema.publishJobs);
  expect(saved).toMatchObject({
    title: "My title",
    caption: "My caption",
    mediaKey: "original.mp4",
    idempotencyKey: "same-intent",
    externalPostId: null,
    externalUrl: null,
    providerState: { dataDeleted: true },
  });
});

it("does not delete a reconnect when an old refresh is rejected", async () => {
  const { removeRejectedYouTubeConnection } = await import("./youtube-data");
  const rows = await db.select().from(schema.platformConnections);
  const row = rows.find(
    (r) => r.userId === "owner" && r.platform === "youtube",
  )!;
  expect(
    await removeRejectedYouTubeConnection("owner", {
      id: row.id,
      accessTokenEnc: "stale",
    }),
  ).toBe(false);
  expect(await db.select().from(schema.platformConnections)).toHaveLength(3);
  expect(await removeRejectedYouTubeConnection("owner", row)).toBe(true);
  expect(await db.select().from(schema.platformConnections)).toHaveLength(2);
});

it("cleans historical orphans and old metadata without changing fresh linked jobs", async () => {
  const { pruneYouTubeData } = await import("./youtube-data");
  await db.insert(schema.publishJobs).values([
    {
      userId: "owner",
      platform: "youtube",
      mediaKey: "old.mp4",
      externalPostId: "old",
      createdAt: new Date(0),
    },
    {
      userId: "owner",
      platform: "youtube",
      mediaKey: "fresh.mp4",
      externalPostId: "fresh",
    },
    {
      userId: "owner",
      platform: "instagram",
      mediaKey: "ig.mp4",
      externalPostId: "ig",
      createdAt: new Date(0),
    },
  ]);
  await pruneYouTubeData();
  const rows = await db.select().from(schema.publishJobs);
  expect(rows.find((r) => r.mediaKey === "old.mp4")?.externalPostId).toBeNull();
  expect(rows.find((r) => r.mediaKey === "fresh.mp4")?.externalPostId).toBe(
    "fresh",
  );
  expect(rows.find((r) => r.mediaKey === "ig.mp4")?.externalPostId).toBe("ig");
  // Simulate a historical disconnect that removed only credentials.
  await client.exec(
    "DELETE FROM platform_connections WHERE user_id = 'owner' AND platform = 'youtube'",
  );
  await pruneYouTubeData();
  expect(
    (await db.select().from(schema.publishJobs)).find(
      (r) => r.mediaKey === "fresh.mp4",
    )?.externalPostId,
  ).toBeNull();
});

it("daily validation detects external revocation and leaves other providers untouched", async () => {
  const { maintainYouTubeData } =
    await import("@/lib/publish/youtube-maintenance");
  await client.exec(
    "UPDATE platform_connections SET updated_at = now() - interval '2 days' WHERE user_id = 'owner' AND platform = 'youtube'",
  );
  refreshAccessToken.mockRejectedValue(
    new Error("oauth_refresh_invalid_grant"),
  );
  const result = await maintainYouTubeData(Date.now() + 15_000);
  expect(result).toMatchObject({ removed: 1, failed: 0, pending: false });
  expect(
    (await db.select().from(schema.platformConnections)).map((r) => r.platform),
  ).toContain("instagram");
});
it("retains a retryable grant during an outage but bounds unverified retention", async () => {
  const { maintainYouTubeData } =
    await import("@/lib/publish/youtube-maintenance");
  await client.exec(
    "UPDATE platform_connections SET updated_at = now() - interval '2 days' WHERE user_id = 'owner' AND platform = 'youtube'",
  );
  refreshAccessToken.mockRejectedValue(new Error("google_refresh_503"));
  expect(await maintainYouTubeData(Date.now() + 15_000)).toMatchObject({
    removed: 0,
    failed: 1,
    pending: true,
  });
  await client.exec(
    "UPDATE platform_connections SET updated_at = now() - interval '26 days' WHERE user_id = 'owner' AND platform = 'youtube'",
  );
  expect(await maintainYouTubeData(Date.now() + 15_000)).toMatchObject({
    removed: 1,
    failed: 1,
    pending: false,
  });
});
it("refreshes unattended valid grants so they do not expire from inactivity", async () => {
  const { maintainYouTubeData } =
    await import("@/lib/publish/youtube-maintenance");
  await client.exec(
    "UPDATE platform_connections SET updated_at = now() - interval '26 days' WHERE user_id = 'owner' AND platform = 'youtube'",
  );
  refreshAccessToken.mockResolvedValue({
    accessToken: "new-access",
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  expect(await maintainYouTubeData(Date.now() + 15_000)).toMatchObject({
    checked: 1,
    removed: 0,
    failed: 0,
    pending: false,
  });
});
