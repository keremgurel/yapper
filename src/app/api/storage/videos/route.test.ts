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
    videos: [{ mediaKey: "owner/video", bytes: 100, title: "owner's clip" }],
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
