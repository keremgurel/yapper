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

it("keeps the latest final edit after posting, outside the temporary upload slot", async () => {
  const source = await master("u/owner/project-current.mp4");
  await saveEditorMaster("owner", input(source.id));
  await db.insert(schema.publishJobs).values({
    userId: "owner",
    platform: "youtube",
    status: "published",
    mediaKey: source.mediaKey!,
    updatedAt: old,
  });
  expect(await findWaitingPosterVideo("owner")).toBeNull();
  expect(await findPostedMedia(now, 50)).toEqual([]);
  expect(
    await releasePostedMedia(
      { userId: "owner", mediaKey: source.mediaKey! },
      "posted",
      now,
    ),
  ).toBe("skipped");
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
