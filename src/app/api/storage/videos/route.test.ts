import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
const client = new PGlite();
const db = drizzle(client, { schema });
const mocks = vi.hoisted(() => ({ auth: vi.fn(), drain: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@/lib/db/r2-drain", () => ({ drainR2AfterResponse: mocks.drain }));
import { GET, DELETE } from "./route";
const old = new Date("2026-01-01T00:00:00Z");
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  await client.exec("TRUNCATE users, r2_objects CASCADE");
  await db.insert(schema.users).values([
    { id: "owner", storageBytes: 100 },
    { id: "other", storageBytes: 100 },
  ]);
  for (const userId of ["owner", "other"]) {
    await db.insert(schema.r2Objects).values({
      userId,
      mediaKey: `${userId}/video`,
      purpose: "recording",
      state: "active",
      mediaBytes: 100,
      createdAt: old,
    });
    await db.insert(schema.submissions).values({
      userId,
      mediaKey: `${userId}/video`,
      mediaBytes: 100,
      kind: "video",
      status: "complete",
      title: `${userId}'s clip`,
      transcript: ["keep these words"],
      createdAt: old,
      updatedAt: old,
    });
  }
});
afterAll(async () => {
  await client.close();
});
const request = (mediaKey: string) =>
  new Request("https://ypr.app/api/storage/videos", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mediaKey }),
  });
it("lists only files from the native session's own account", async () => {
  const response = await GET();
  expect(await response.json()).toEqual({
    videos: [
      {
        mediaKey: "owner/video",
        bytes: 100,
        title: "owner's clip",
        origin: "recording",
        platform: null,
        retention: "stored",
      },
    ],
  });
  expect((await DELETE(request("other/video"))).status).toBe(404);
});
it("removes the current file once while preserving its transcript", async () => {
  const replies = await Promise.all([
    DELETE(request("owner/video")),
    DELETE(request("owner/video")),
  ]);
  expect(replies.filter((r) => r.status === 200)).toHaveLength(1);
  const [owner] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, "owner"));
  expect(owner.storageBytes).toBe(0);
  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.userId, "owner"));
  expect(submission.mediaKey).toBeNull();
  expect(submission.transcript).toEqual(["keep these words"]);
  expect(mocks.drain).toHaveBeenCalledOnce();
});
it("refuses a file while a scheduled post still needs it", async () => {
  await db.insert(schema.publishingSchedules).values({
    userId: "owner",
    platform: "youtube",
    externalAccountId: "channel",
    accountLabel: "Channel",
    title: "Queued",
    input: {
      mediaKey: "owner/video",
      title: "Queued",
      privacyStatus: "public",
    },
    scheduledFor: new Date(),
    timezone: "UTC",
    requestKey: crypto.randomUUID(),
    requestHash: "hash",
    entryIndex: 0,
    status: "scheduled",
  });
  expect((await DELETE(request("owner/video"))).status).toBe(409);
  expect(mocks.drain).not.toHaveBeenCalled();
  expect(
    (
      await db.select().from(schema.users).where(eq(schema.users.id, "owner"))
    )[0].storageBytes,
  ).toBe(100);
});
it("requires authentication for both listing and deletion", async () => {
  mocks.auth.mockResolvedValue({ userId: null });
  expect((await GET()).status).toBe(401);
  expect((await DELETE(request("owner/video"))).status).toBe(401);
});

it("allows explicitly removing a new upload without waiting for its retention grace", async () => {
  await db
    .update(schema.submissions)
    .set({ updatedAt: new Date() })
    .where(eq(schema.submissions.userId, "owner"));
  await db
    .update(schema.r2Objects)
    .set({ deleteNotBefore: new Date(Date.now() + 60_000) })
    .where(eq(schema.r2Objects.userId, "owner"));
  expect((await DELETE(request("owner/video"))).status).toBe(200);
});

it("identifies editor exports and cross-post imports even when Uploads is empty", async () => {
  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.userId, "owner"));
  await db.insert(schema.contentItems).values({
    userId: "owner",
    title: "ep14",
    submissionId: submission.id,
    sourceUrl: "yapper://project/0a000000-0000-0000-0000-000000000001",
    sourceClientId: "native-project:0a000000-0000-0000-0000-000000000001",
    editorRevision: "a".repeat(64),
    status: "posted",
  });
  await db.insert(schema.r2Objects).values({
    userId: "owner",
    mediaKey: "owner/import",
    purpose: "import",
    state: "active",
    mediaBytes: 25,
  });
  await db.insert(schema.importedPlatformMedia).values({
    userId: "owner",
    platform: "instagram",
    externalPostId: "post",
    mediaKey: "owner/import",
    title: "Imported post",
    mediaBytes: 25,
  });
  const response = await GET();
  const { videos } = await response.json();
  expect(videos).toHaveLength(2);
  expect(
    videos.find((v: { origin: string }) => v.origin === "editor_export"),
  ).toMatchObject({ retention: "editor_current", bytes: 100 });
  expect(
    videos.find((v: { origin: string }) => v.origin === "import"),
  ).toMatchObject({ title: "Imported post", platform: "instagram", bytes: 25 });
  // The title/source is explanatory; the same ownership and active-use guards still apply.
  expect((await DELETE(request("owner/video"))).status).toBe(409);
  expect((await DELETE(request("owner/import"))).status).toBe(200);
});

it("distinguishes expired reservations without silently changing quota accounting", async () => {
  const { getStorageUsageDetails } = await import("@/lib/db/storage-usage");
  for (const [key, expires] of [
    ["expired", old],
    ["uploading", new Date(Date.now() + 60_000)],
  ] as const) {
    await db.insert(schema.r2Objects).values({
      userId: "owner",
      mediaKey: key,
      purpose: "thumbnail",
      state: "pending_upload",
      mediaBytes: 15,
      uploadExpiresAt: expires,
    });
  }
  const usage = await getStorageUsageDetails("owner");
  expect(usage).toMatchObject({
    reservedBytes: 30,
    reservedCount: 2,
    expiredReservedCount: 1,
  });
  expect(usage.media.recording).toEqual({ bytes: 100, count: 1 });
});

it("shows retry retention for archived exports, not current-project protection", async () => {
  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.userId, "owner"));
  await db.insert(schema.contentItems).values({
    userId: "owner",
    title: "Prior export",
    submissionId: submission.id,
    sourceClientId: "native-project:project:archived:item",
    editorRevision: "a".repeat(64),
    status: "posted",
  });
  await db.insert(schema.publishJobs).values({
    userId: "owner",
    platform: "youtube",
    mediaKey: "owner/video",
    status: "published",
  });
  const { videos } = await (await GET()).json();
  expect(videos[0]).toMatchObject({
    origin: "editor_export",
    retention: "retry",
  });
});
