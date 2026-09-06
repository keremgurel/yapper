import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import * as schema from "@/lib/db/schema";
import { POST } from "./route";

const client = new PGlite();
const db = drizzle(client, { schema });
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/client", () => ({ getDb: () => db }));
vi.mock("@clerk/nextjs/server", () => ({ auth }));
vi.mock("@/lib/billing/gate", () => ({ canUsePremium: async () => true }));
vi.mock("@/lib/db/billing", () => ({ getStorageQuota: async () => 1_000_000 }));
vi.mock("@/lib/db/users", () => ({
  ensureUser: async () => {},
  getStorageBytes: async () => 0,
}));
vi.mock("@/lib/r2", () => ({
  deleteObject: vi.fn(),
  headObjectBytes: async () => 128,
  ownsKey: (user: string, key: string) => key.startsWith(`${user}/`),
}));
const mediaKey = "user_test/take.mp4";
const request = (createLibraryItem = false) =>
  new Request("https://test/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaKey, title: "Saved take", createLibraryItem }),
  }) as NextRequest;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users, r2_objects CASCADE");
  auth.mockResolvedValue({ userId: "user_test" });
  await db.insert(schema.users).values({ id: "user_test" });
  await db.insert(schema.r2Objects).values({
    mediaKey,
    userId: "user_test",
    purpose: "recording",
    state: "pending_upload",
    mediaBytes: 128,
    uploadExpiresAt: new Date(Date.now() + 60_000),
  });
});
afterAll(async () => {
  await client.close();
});

it("persists one recording and one storage charge across response-loss retries", async () => {
  const first = await (await POST(request())).json();
  const replay = await (await POST(request())).json();
  expect(replay.submission.id).toBe(first.submission.id);
  expect(await db.select().from(schema.submissions)).toHaveLength(1);
  expect((await db.select().from(schema.users))[0].storageBytes).toBe(128);
  expect((await db.select().from(schema.r2Objects))[0].state).toBe("active");
});

it("cannot attach another account's uploaded take", async () => {
  auth.mockResolvedValue({ userId: "user_other" });
  expect((await POST(request())).status).toBe(400);
  expect(await db.select().from(schema.submissions)).toEqual([]);
  expect((await db.select().from(schema.users))[0].storageBytes).toBe(0);
});

it("creates a linked Library item for a standalone take and preserves its edits on replay", async () => {
  const first = await (await POST(request(true))).json();
  expect(first.submission.contentItemId).toBeTruthy();
  await db.update(schema.contentItems).set({ title: "Edited after saving" });
  const replay = await (await POST(request(true))).json();
  expect(replay.submission.id).toBe(first.submission.id);
  expect(replay.submission.contentItemId).toBe(first.submission.contentItemId);
  const items = await db.select().from(schema.contentItems);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    title: "Edited after saving",
    stage: "library",
    submissionId: first.submission.id,
  });
  expect(items[0].projectId).toBeTruthy();
  expect((await db.select().from(schema.users))[0].storageBytes).toBe(128);
});

it("does not reuse a training result as a Studio recording", async () => {
  const [training] = await db
    .insert(schema.submissions)
    .values({
      userId: "user_test",
      mediaKey,
      mediaBytes: 128,
      kind: "video",
      status: "complete",
      surface: "training",
    })
    .returning();
  const saved = await (await POST(request())).json();
  expect(saved.submission.id).not.toBe(training.id);
  const rows = await db.select().from(schema.submissions);
  expect(rows.filter((row) => row.surface === "studio")).toHaveLength(1);
  expect((await (await POST(request())).json()).submission.id).toBe(
    saved.submission.id,
  );
});
