import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import { saveEditorMaster } from "./editor-projects";
import { archivedMediaKeysForPosts } from "./publish";
import { findWaitingPosterVideo } from "./poster-slot";
import {
  findPostedMedia,
  findSupersededMedia,
  releasePostedMedia,
} from "./posted-media-retention";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
vi.mock("@/lib/publish/tokens", () => ({
  encryptToken: (value: string) => value,
}));
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
afterAll(async () => {
  await client.close();
});
beforeEach(async () => {
  await client.exec("TRUNCATE users, r2_objects CASCADE");
  await db.insert(schema.users).values([{ id: "owner" }, { id: "other" }]);
});
const old = new Date("2026-09-01T00:00:00Z");
const now = new Date("2026-10-06T00:00:00Z");
async function master(key: string, owner = "owner") {
  await db.insert(schema.r2Objects).values({
    userId: owner,
    mediaKey: key,
    purpose: "recording",
    state: "active",
    mediaBytes: 100,
    createdAt: old,
  });
  const [row] = await db
    .insert(schema.submissions)
    .values({
      userId: owner,
      kind: "video",
      status: "complete",
      mediaKey: key,
      mediaBytes: 100,
      createdAt: old,
      updatedAt: old,
    })
    .returning();
  return row;
}
function input(
  submissionId: string,
  revision = "a".repeat(64),
  editedAt = old,
) {
  return {
    projectId: "0a000000-0000-0000-0000-000000000001",
    submissionId,
    title: "Final edit",
    revision,
    editedAt,
    transcript: "The words in the edit.",
  };
}

it("never advertises retired masters as reusable platform videos", async () => {
  for (const state of ["active", "delete_pending", "deleted"] as const) {
    const key = `u/owner/${state}.mp4`;
    await master(key);
    await db
      .update(schema.r2Objects)
      .set({ state, deletedAt: state === "deleted" ? old : null })
      .where(eq(schema.r2Objects.mediaKey, key));
    await db.insert(schema.publishJobs).values({
      userId: "owner",
      platform: "instagram",
      status: "published",
      mediaKey: key,
      externalPostId: state,
    });
  }
  expect([
    ...(await archivedMediaKeysForPosts("owner", "instagram", [
      "active",
      "delete_pending",
      "deleted",
    ])),
  ]).toEqual([["active", "u/owner/active.mp4"]]);
  expect(
    (await archivedMediaKeysForPosts("other", "instagram", ["active"])).size,
  ).toBe(0);
});

it("replaces a project's master in place and rejects an older upload", async () => {
  const first = await master("u/owner/project-first.mp4");
  const second = await master("u/owner/project-second.mp4");
  const a = await saveEditorMaster("owner", input(first.id));
  const b = await saveEditorMaster(
    "owner",
    input(second.id, "b".repeat(64), now),
  );
  expect(b.id).toBe(a.id);
  expect(b.submissionId).toBe(second.id);
  expect(b.transcriptStatus).toBe("ready");
  expect(await db.select().from(schema.contentItems)).toHaveLength(1);
  await expect(saveEditorMaster("owner", input(first.id))).rejects.toThrow(
    "newer_edit_available",
  );
});

it("cannot attach another user's master or a deleted master", async () => {
  const other = await master("u/other/project.mp4", "other");
  await expect(saveEditorMaster("owner", input(other.id))).rejects.toThrow(
    "bad_submission",
  );
  const retired = await master("u/owner/project-retired.mp4");
  await db
    .update(schema.r2Objects)
    .set({ state: "delete_pending" })
    .where(eq(schema.r2Objects.mediaKey, retired.mediaKey!));
  await expect(saveEditorMaster("owner", input(retired.id))).rejects.toThrow(
    "media_unavailable",
  );
});

it("releases a posted current export and reattaches a fresh upload without losing its writing", async () => {
  const source = await master("u/owner/project-current.mp4");
  const idea = await saveEditorMaster("owner", input(source.id));
  await db
    .update(schema.users)
    .set({ storageBytes: 100 })
    .where(eq(schema.users.id, "owner"));
  await db
    .update(schema.contentItems)
    .set({ status: "posted", pillar: "Ship log" })
    .where(eq(schema.contentItems.id, idea.id));
  await db.insert(schema.publishJobs).values({
    userId: "owner",
    platform: "youtube",
    status: "published",
    mediaKey: source.mediaKey!,
    updatedAt: old,
  });
  expect(await findWaitingPosterVideo("owner")).toBeNull();
  expect(await findPostedMedia(now, 50)).toEqual([
    { userId: "owner", mediaKey: source.mediaKey },
  ]);
  expect(
    await releasePostedMedia(
      { userId: "owner", mediaKey: source.mediaKey! },
      "posted",
      now,
    ),
  ).toBe("released");
  const [saved] = await db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.id, idea.id));
  expect(saved).toMatchObject({
    status: "posted",
    script: "The words in the edit.",
    recordedTranscript: "The words in the edit.",
    pillar: "Ship log",
    sourceUrl: idea.sourceUrl,
    submissionId: null,
  });
  expect(
    (
      await db.select().from(schema.users).where(eq(schema.users.id, "owner"))
    )[0].storageBytes,
  ).toBe(0);
  expect((await db.select().from(schema.r2Objects))[0].state).toBe(
    "delete_pending",
  );
  await expect(saveEditorMaster("owner", input(source.id))).rejects.toThrow(
    "bad_submission",
  );
  const fresh = await master("u/owner/project-repost.mp4");
  expect(await saveEditorMaster("owner", input(fresh.id))).toMatchObject({
    id: idea.id,
    status: "posted",
    script: saved.script,
    pillar: saved.pillar,
    submissionId: fresh.id,
  });
  // Historical success for the old key cannot retire an as-yet unposted upload.
  expect(
    await releasePostedMedia(
      { userId: "owner", mediaKey: fresh.mediaKey! },
      "posted",
      now,
    ),
  ).toBe("skipped");
  expect(await findPostedMedia(now, 50)).toEqual([]);
});

it("collects superseded project masters without retiring the latest edit", async () => {
  const a = await master("u/owner/project-a.mp4");
  const b = await master("u/owner/project-b.mp4");
  await saveEditorMaster("owner", input(a.id));
  await saveEditorMaster("owner", input(b.id, "b".repeat(64), now));
  expect(await findSupersededMedia(50, "owner")).toEqual([
    { userId: "owner", mediaKey: a.mediaKey },
  ]);
  expect(await findWaitingPosterVideo("owner")).toBeNull();
});

it("keeps published scripts when the same project gets another edit", async () => {
  const a = await master("u/owner/project-posted.mp4");
  const b = await master("u/owner/project-new.mp4");
  const original = await saveEditorMaster("owner", input(a.id));
  expect(original.script).toBe("The words in the edit.");
  await db
    .update(schema.contentItems)
    .set({ status: "posted" })
    .where(eq(schema.contentItems.id, original.id));
  await db.insert(schema.publishJobs).values({
    userId: "owner",
    contentItemId: original.id,
    platform: "youtube",
    mediaKey: a.mediaKey!,
    status: "published",
    updatedAt: old,
  });
  const latest = await saveEditorMaster("owner", {
    ...input(b.id, "b".repeat(64), now),
    transcript: "The new edit's words.",
  });
  expect(latest.id).not.toBe(original.id);
  expect(latest.script).toBe("The new edit's words.");
  expect(latest.status).toBe("ready");
  const [archived] = await db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.id, original.id));
  expect(archived).toMatchObject({
    status: "posted",
    script: "The words in the edit.",
    recordedTranscript: "The words in the edit.",
    submissionId: a.id,
  });
  const { listContentItems } = await import("./content");
  expect((await listContentItems("owner")).map((i) => i.id)).toEqual(
    expect.arrayContaining([original.id, latest.id]),
  );
  expect(
    (await listContentItems("owner", { includePosterUploads: true })).map(
      (i) => i.id,
    ),
  ).toEqual([latest.id]);
  expect(await findPostedMedia(now, 50)).toEqual([
    { userId: "owner", mediaKey: a.mediaKey },
  ]);
  expect(
    await saveEditorMaster("owner", {
      ...input(b.id, "b".repeat(64), now),
      transcript: "The new edit's words.",
    }),
  ).toMatchObject({ id: latest.id });
});

it("keeps a publishing revision separate from a newer editor upload", async () => {
  const a = await master("u/owner/project-publishing.mp4");
  const b = await master("u/owner/project-next.mp4");
  const original = await saveEditorMaster("owner", input(a.id));
  await db.insert(schema.publishJobs).values({
    userId: "owner",
    contentItemId: original.id,
    platform: "youtube",
    mediaKey: a.mediaKey!,
    status: "uploading",
  });
  const latest = await saveEditorMaster(
    "owner",
    input(b.id, "b".repeat(64), now),
  );
  expect(latest.id).not.toBe(original.id);
  expect(await db.select().from(schema.contentItems)).toHaveLength(2);
});

it("keeps the scheduled script attached to its scheduled media after a new edit", async () => {
  const a = await master("u/owner/project-scheduled.mp4");
  const b = await master("u/owner/project-later.mp4");
  const original = await saveEditorMaster("owner", input(a.id));
  await db.insert(schema.publishingSchedules).values({
    userId: "owner",
    requestKey: crypto.randomUUID(),
    requestHash: "hash",
    entryIndex: 0,
    platform: "youtube",
    externalAccountId: "channel",
    accountLabel: "Channel",
    title: "Scheduled edit",
    contentItemId: original.id,
    input: {
      mediaKey: a.mediaKey!,
    } as typeof schema.publishingSchedules.$inferInsert.input,
    scheduledFor: now,
    timezone: "UTC",
  });
  const latest = await saveEditorMaster("owner", {
    ...input(b.id, "b".repeat(64), now),
    transcript: "Later words",
  });
  expect(latest.id).not.toBe(original.id);
  const [scheduled] = await db
    .select()
    .from(schema.contentItems)
    .where(eq(schema.contentItems.id, original.id));
  expect(scheduled.script).toBe("The words in the edit.");
  expect(scheduled.submissionId).toBe(a.id);
});
