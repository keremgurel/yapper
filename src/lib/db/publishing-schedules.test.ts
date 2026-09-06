import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as schema from "./schema";
import {
  changePublishingSchedule,
  claimDueSchedules,
  createPublishingSchedules,
  listPublishingSchedules,
  reconcileScheduleOutcomes,
  scheduleAttemptKey,
  settlePublishingSchedule,
  type NewPublishingSchedule,
} from "./publishing-schedules";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
const now = new Date("2026-09-05T12:00:00Z");
const mediaKey = "user_test/video.mp4";
const entry = (
  patch: Partial<NewPublishingSchedule> = {},
): NewPublishingSchedule => ({
  platform: "youtube",
  externalAccountId: "channel_a",
  accountLabel: "My channel",
  title: "Reviewed title",
  input: { mediaKey, title: "Reviewed title", privacyStatus: "public" },
  scheduledFor: now,
  timezone: "Europe/Istanbul",
  ...patch,
});
const save = (entries = [entry()], key = randomUUID(), hash = "reviewed") =>
  createPublishingSchedules("user_test", key, hash, entries);

beforeAll(async () => {
  // Run every real migration against an ephemeral Postgres engine. This never
  // uses DATABASE_URL. PGlite is single-connection: multi-worker lock contention
  // still requires staging verification, not a claimed concurrency test here.
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users, r2_objects CASCADE");
  await db
    .insert(schema.users)
    .values([{ id: "user_test" }, { id: "user_other" }]);
  await db.insert(schema.r2Objects).values({
    mediaKey,
    userId: "user_test",
    purpose: "recording",
    state: "active",
  });
});
afterAll(async () => {
  await client.close();
});

describe("durable publishing schedules", () => {
  it("saves the entire selection and replays it even if its source was removed later", async () => {
    const key = randomUUID();
    const entries = [entry(), entry({ platform: "instagram" })];
    const saved = await save(entries, key);
    await db.update(schema.r2Objects).set({ state: "delete_pending" });
    expect(await save(entries, key)).toEqual(saved);
    expect(await listPublishingSchedules("user_test")).toHaveLength(2);
    expect(await listPublishingSchedules("user_other")).toEqual([]);
    await expect(save(entries, key, "changed")).rejects.toThrow(
      "schedule_request_changed",
    );
  });

  it("rolls back the entire selection when one video is unavailable or belongs to another user", async () => {
    await db.insert(schema.r2Objects).values({
      mediaKey: "other/video.mp4",
      userId: "user_other",
      purpose: "recording",
      state: "active",
    });
    await expect(
      save([entry(), entry({ input: { mediaKey: "other/video.mp4" } })]),
    ).rejects.toThrow("media_unavailable");
    expect(await listPublishingSchedules("user_test")).toEqual([]);
  });

  it("claims only due rows and recovers expired leases with the same publish key", async () => {
    const [original] = await save();
    await save([entry({ scheduledFor: new Date(now.getTime() + 3_600_000) })]);
    const [first] = await claimDueSchedules(3, now);
    expect(first.id).toBe(original.id);
    expect(
      await claimDueSchedules(3, new Date(now.getTime() + 60_000)),
    ).toEqual([]);
    const [recovered] = await claimDueSchedules(
      3,
      new Date(now.getTime() + 7 * 60_000),
    );
    expect(recovered.leaseToken).not.toBe(first.leaseToken);
    expect(scheduleAttemptKey(recovered)).toBe(scheduleAttemptKey(first));
    await settlePublishingSchedule(first, {
      status: "failed",
      error: "late_old_worker",
    });
    expect(
      (await listPublishingSchedules("user_test")).find(
        (row) => row.id === original.id,
      )?.status,
    ).toBe("running");
    await settlePublishingSchedule(recovered, {
      status: "published",
      externalUrl: "https://youtu.be/example",
    });
    expect(
      (await listPublishingSchedules("user_test")).find(
        (row) => row.id === original.id,
      )?.status,
    ).toBe("published");
  });

  it("enforces ownership and disallows cancellation or rescheduling after a worker claims", async () => {
    const [row] = await save();
    expect(
      await changePublishingSchedule("user_other", row.id, "cancel"),
    ).toBeNull();
    await claimDueSchedules(3, now);
    await expect(
      changePublishingSchedule("user_test", row.id, "cancel"),
    ).rejects.toThrow("schedule_already_started");
    await expect(
      changePublishingSchedule("user_test", row.id, "reschedule", now),
    ).rejects.toThrow("schedule_already_started");
  });

  it("cancels before sending and never picks up a cancelled row", async () => {
    const [row] = await save();
    expect(
      (await changePublishingSchedule("user_test", row.id, "cancel"))?.status,
    ).toBe("cancelled");
    expect(await claimDueSchedules(3, now)).toEqual([]);
  });

  it("keeps a retry key if no platform attempt occurred and advances only after a known failure", async () => {
    const [row] = await save([entry({ status: "failed" })]);
    expect(
      (await changePublishingSchedule("user_test", row.id, "retry", now))
        ?.attempt,
    ).toBe(0);
    await db
      .update(schema.publishingSchedules)
      .set({ status: "failed" })
      .where(eq(schema.publishingSchedules.id, row.id));
    const [job] = await db
      .insert(schema.publishJobs)
      .values({
        userId: "user_test",
        platform: "youtube",
        mediaKey,
        idempotencyKey: scheduleAttemptKey(row),
        status: "processing",
      })
      .returning();
    await expect(
      changePublishingSchedule("user_test", row.id, "retry", now),
    ).rejects.toThrow("publish_state_pending");
    await db
      .update(schema.publishJobs)
      .set({ status: "failed" })
      .where(eq(schema.publishJobs.id, job.id));
    expect(
      (await changePublishingSchedule("user_test", row.id, "retry", now))
        ?.attempt,
    ).toBe(1);
  });

  it("extends cover retention with a reschedule and rolls back if the cover is unavailable", async () => {
    const thumbnailKey = "user_test/cover.jpg";
    await db.insert(schema.r2Objects).values({
      mediaKey: thumbnailKey,
      userId: "user_test",
      purpose: "thumbnail",
      state: "pending_upload",
      uploadExpiresAt: now,
    });
    const [row] = await save([entry({ input: { mediaKey, thumbnailKey } })]);
    const next = new Date(now.getTime() + 10 * 86400_000);
    await changePublishingSchedule("user_test", row.id, "reschedule", next);
    const [cover] = await db
      .select()
      .from(schema.r2Objects)
      .where(eq(schema.r2Objects.mediaKey, thumbnailKey));
    expect(cover.uploadExpiresAt?.getTime()).toBe(next.getTime() + 86400_000);
    await db
      .update(schema.r2Objects)
      .set({ state: "delete_pending" })
      .where(eq(schema.r2Objects.mediaKey, thumbnailKey));
    await expect(
      changePublishingSchedule("user_test", row.id, "reschedule", now),
    ).rejects.toThrow("thumbnail_unavailable");
    expect(
      (await listPublishingSchedules("user_test"))[0].scheduledFor,
    ).toEqual(next);
  });

  it("reconciles a delayed completion without making a new provider attempt", async () => {
    const [row] = await save([
      entry({
        platform: "tiktok",
        status: "needs_attention",
        error: "publish_state_pending",
      }),
    ]);
    const [job] = await db
      .insert(schema.publishJobs)
      .values({
        userId: "user_test",
        platform: "tiktok",
        mediaKey,
        idempotencyKey: scheduleAttemptKey(row),
        status: "processing",
      })
      .returning();
    expect(await reconcileScheduleOutcomes()).toEqual([]);
    await db
      .update(schema.publishJobs)
      .set({ status: "published" })
      .where(eq(schema.publishJobs.id, job.id));
    await reconcileScheduleOutcomes();
    expect((await listPublishingSchedules("user_test"))[0]).toMatchObject({
      status: "draft",
      publishJobId: job.id,
      error: null,
    });
  });
});
