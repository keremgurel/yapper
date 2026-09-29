import { registerImportedMedia } from "./imported-media";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "./schema";
import {
  findSupersededMedia,
  releasePostedMedia,
  releaseSupersededMediaBatch,
} from "./posted-media-retention";
import { claimNextR2Object, processR2LifecycleBatch } from "./r2-lifecycle";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
const remove = vi.hoisted(() =>
  vi.fn<(key: string) => Promise<void>>(async () => {}),
);
vi.mock("@/lib/r2", () => ({ deleteObject: remove }));
const now = new Date("2026-09-29T12:00:00Z");
const old = new Date("2026-09-01T12:00:00Z");
const recent = new Date("2026-09-22T12:00:00Z");

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users, r2_objects CASCADE");
  remove.mockClear();
  await db.insert(schema.users).values([{ id: "owner" }, { id: "other" }]);
});
afterAll(async () => {
  await client.close();
});

async function video(key: string, createdAt = old, userId = "owner") {
  await db.insert(schema.r2Objects).values({
    userId,
    mediaKey: key,
    purpose: "recording",
    state: "active",
    mediaBytes: 100,
    createdAt,
  });
  const [submission] = await db
    .insert(schema.submissions)
    .values({
      userId,
      kind: "video",
      status: "complete",
      title: key,
      mediaKey: key,
      mediaBytes: 100,
      createdAt,
      updatedAt: createdAt,
      transcript: [{ text: "Keep the transcript" }],
    })
    .returning();
  await db
    .update(schema.users)
    .set({ storageBytes: sql`${schema.users.storageBytes} + 100` })
    .where(eq(schema.users.id, userId));
  return submission;
}
async function publish(
  key: string,
  status: "uploading" | "published" | "failed",
  updatedAt = old,
) {
  await db.insert(schema.publishJobs).values({
    userId: "owner",
    mediaKey: key,
    platform: "youtube",
    status,
    updatedAt,
  });
}
async function schedule(
  key: string,
  status: "scheduled" | "running" | "needs_attention" = "scheduled",
) {
  await db.insert(schema.publishingSchedules).values({
    userId: "owner",
    platform: "youtube",
    externalAccountId: "channel",
    accountLabel: "Channel",
    title: key,
    input: { mediaKey: key, title: key, privacyStatus: "public" },
    scheduledFor: now,
    timezone: "UTC",
    requestKey: randomUUID(),
    requestHash: key,
    entryIndex: 0,
    status,
  });
}

it("reclaims legacy unposted uploads and imports, keeps one video, text and logos, and refunds shared objects once", async () => {
  const first = await video("old");
  await video("current", recent);
  await video("other/current", recent, "other");
  await db.insert(schema.contentItems).values({
    userId: "owner",
    title: "My script",
    script: "Keep this script",
    recordedTranscript: "Keep these words",
    submissionId: first.id,
  });
  await db.insert(schema.importedPlatformMedia).values({
    userId: "owner",
    platform: "instagram",
    externalPostId: "shared",
    mediaKey: "old",
    mediaBytes: 100,
    createdAt: old,
  });
  await db.insert(schema.r2Objects).values([
    {
      userId: "owner",
      mediaKey: "import",
      purpose: "import",
      state: "active",
      mediaBytes: 50,
      createdAt: old,
    },
    {
      userId: "owner",
      mediaKey: "logo",
      purpose: "brand_logo",
      state: "active",
      mediaBytes: 5,
      createdAt: old,
    },
  ]);
  await db.insert(schema.importedPlatformMedia).values({
    userId: "owner",
    platform: "instagram",
    externalPostId: "import-only",
    mediaKey: "import",
    mediaBytes: 50,
    createdAt: old,
  });
  await db
    .update(schema.users)
    .set({ storageBytes: 255 })
    .where(eq(schema.users.id, "owner"));
  expect(await findSupersededMedia(500, "owner")).toHaveLength(2);
  expect(await releaseSupersededMediaBatch(now, 500, "owner")).toEqual({
    released: 2,
    failed: 0,
  });
  expect(await releaseSupersededMediaBatch(now, 500, "owner")).toEqual({
    released: 0,
    failed: 0,
  });
  expect(
    (
      await db.select().from(schema.users).where(eq(schema.users.id, "owner"))
    )[0].storageBytes,
  ).toBe(105);
  expect((await db.select().from(schema.contentItems))[0]).toMatchObject({
    script: "Keep this script",
    recordedTranscript: "Keep these words",
    submissionId: null,
  });
  expect(
    (
      await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.id, first.id))
    )[0],
  ).toMatchObject({
    mediaKey: null,
    mediaBytes: 0,
    transcript: [{ text: "Keep the transcript" }],
  });
  expect(await db.select().from(schema.importedPlatformMedia)).toHaveLength(0);
  const result = await processR2LifecycleBatch({ limit: 10 });
  expect(result.deleted).toBe(2);
  expect(remove.mock.calls.map((args) => args[0]).sort()).toEqual([
    "import",
    "old",
  ]);
  expect(
    (
      await db
        .select()
        .from(schema.r2Objects)
        .where(eq(schema.r2Objects.mediaKey, "logo"))
    )[0].state,
  ).toBe("active");
});

it.each(["scheduled", "running", "needs_attention"] as const)(
  "rechecks a %s schedule created after candidate discovery",
  async (status) => {
    await video("old");
    await video("current", recent);
    const [candidate] = await findSupersededMedia();
    await schedule("old", status);
    expect(await releasePostedMedia(candidate, "superseded", now)).toBe(
      "skipped",
    );
    expect(await claimNextR2Object(now)).toBeNull();
  },
);

it("protects live publishing, fresh failures and a transcription lease", async () => {
  await video("uploading");
  await video("retry");
  await video("transcribing");
  await video("current", recent);
  await publish("uploading", "uploading"); // Even a long-running job must be resolved before deletion.
  await publish("retry", "failed", now);
  await db
    .update(schema.r2Objects)
    .set({ deleteNotBefore: new Date(now.getTime() + 60_000) })
    .where(eq(schema.r2Objects.mediaKey, "transcribing"));
  expect(await releaseSupersededMediaBatch(now)).toEqual({
    released: 0,
    failed: 0,
  });
});

it("rechecks the latest waiting video when the newer one was removed", async () => {
  await video("old");
  const latest = await video("current", recent);
  const [candidate] = await findSupersededMedia();
  await db
    .delete(schema.submissions)
    .where(eq(schema.submissions.id, latest.id));
  expect(await releasePostedMedia(candidate, "superseded", now)).toBe(
    "skipped",
  );
});

it("does not let a scheduled or posted newer file replace the waiting slot", async () => {
  await video("waiting");
  await video("scheduled", recent);
  await video("posted", recent);
  await schedule("scheduled");
  await publish("posted", "published");
  expect(await findSupersededMedia()).toEqual([]);
  expect(
    await releasePostedMedia(
      { userId: "owner", mediaKey: "posted" },
      "posted",
      now,
    ),
  ).toBe("released");
  expect(
    await releasePostedMedia(
      { userId: "owner", mediaKey: "waiting" },
      "posted",
      now,
    ),
  ).toBe("skipped");
});

it("protects recent registrations while transcription starts, and never ranks pending uploads", async () => {
  await video("preparing", new Date(now.getTime() - 60_000));
  await video("current", now);
  await db.insert(schema.r2Objects).values({
    userId: "owner",
    mediaKey: "pending",
    purpose: "recording",
    state: "pending_upload",
    mediaBytes: 100,
    uploadExpiresAt: new Date(now.getTime() + 60_000),
  });
  expect(await releaseSupersededMediaBatch(now)).toEqual({
    released: 0,
    failed: 0,
  });
});

it("rolls back an import that finishes after another video takes the slot", async () => {
  await video("current", recent);
  await db.insert(schema.r2Objects).values({
    userId: "owner",
    mediaKey: "racing-import",
    purpose: "import",
    state: "pending_upload",
    mediaBytes: 50,
    uploadExpiresAt: new Date(now.getTime() + 60_000),
  });
  await expect(
    registerImportedMedia(
      "owner",
      "instagram",
      "racing-post",
      "racing-import",
      50,
      "New import",
      1000,
    ),
  ).rejects.toThrow("poster_slot_busy");
  expect(await db.select().from(schema.importedPlatformMedia)).toHaveLength(0);
  expect(
    (
      await db.select().from(schema.users).where(eq(schema.users.id, "owner"))
    )[0].storageBytes,
  ).toBe(100);
});

it("an account-scoped worker cannot claim another account's queued deletions", async () => {
  await db.insert(schema.r2Objects).values([
    {
      userId: "other",
      mediaKey: "a-other",
      purpose: "recording",
      state: "delete_pending",
      deleteNotBefore: old,
      nextAttemptAt: old,
    },
    {
      userId: "owner",
      mediaKey: "z-owner",
      purpose: "recording",
      state: "delete_pending",
      deleteNotBefore: old,
      nextAttemptAt: old,
    },
  ]);
  expect(
    await claimNextR2Object(now, 60_000, randomUUID, "owner"),
  ).toMatchObject({ userId: "owner", mediaKey: "z-owner" });
  expect(await claimNextR2Object(now, 60_000, randomUUID, "owner")).toBeNull();
  expect(
    (
      await db
        .select()
        .from(schema.r2Objects)
        .where(eq(schema.r2Objects.mediaKey, "a-other"))
    )[0].state,
  ).toBe("delete_pending");
});
