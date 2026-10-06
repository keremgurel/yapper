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
import { DELETE } from "./route";
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

async function uploadRow(
  userId = "owner",
  sourceUrl = "yapper://poster-upload",
) {
  const [submission] = await db
    .select()
    .from(schema.submissions)
    .where(eq(schema.submissions.userId, userId));
  const [item] = await db
    .insert(schema.contentItems)
    .values({ userId, title: "Upload", submissionId: submission.id, sourceUrl })
    .returning();
  return item;
}
const remove = (id: string) =>
  DELETE(
    new Request("https://studio.ypr.app/api/publish/uploads/" + id, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id }) },
  );
it("removes only the caller's standalone upload and releases its video", async () => {
  const item = await uploadRow();
  expect((await remove(item.id)).status).toBe(200);
  expect(await db.select().from(schema.contentItems)).toHaveLength(0);
  const [owner] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, "owner"));
  expect(owner.storageBytes).toBe(0);
});
it("rejects other accounts and edited projects", async () => {
  expect((await remove((await uploadRow("other")).id)).status).toBe(404);
  expect(
    (await remove((await uploadRow("owner", "yapper://project/123")).id))
      .status,
  ).toBe(404);
});
it("keeps the upload and file while a scheduled post needs it", async () => {
  const item = await uploadRow();
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
  expect((await remove(item.id)).status).toBe(409);
  expect(await db.select().from(schema.contentItems)).toHaveLength(1);
});
