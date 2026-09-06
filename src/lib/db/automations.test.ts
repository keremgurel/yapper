import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import * as schema from "./schema";
import { DEFAULT_AUTOMATION_SETTINGS } from "@/lib/publish/automation-types";
import {
  claimAutomationRules,
  claimAutomationRuns,
  enqueueAutomationRun,
  failAutomationRun,
  finishAutomationScan,
  getAutomation,
  retryAutomationRun,
  saveAutomationRule,
} from "./automations";

const client = new PGlite();
const db = drizzle(client, { schema });
vi.mock("./client", () => ({ getDb: () => db }));
const now = new Date("2026-09-05T12:00:00Z");
const input = {
  version: 0,
  enabled: true,
  settings: DEFAULT_AUTOMATION_SETTINGS,
  sourceAccountId: "instagram_account",
  sourceLabel: "My Instagram",
  accounts: [
    {
      platform: "youtube" as const,
      id: "youtube_account",
      label: "My YouTube",
    },
    { platform: "tiktok" as const, id: "tiktok_account", label: "My TikTok" },
  ],
};
const post = (id = "new_video", date = new Date(now.getTime() + 1000)) => ({
  id,
  caption: "A new video\nLonger description #tag",
  url: "https://www.instagram.com/reel/example",
  publishedAt: date.toISOString(),
});
beforeAll(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
}, 30_000);
beforeEach(async () => {
  await client.exec("TRUNCATE users, r2_objects CASCADE");
  await db
    .insert(schema.users)
    .values([{ id: "user_test" }, { id: "user_other" }]);
  await db.insert(schema.r2Objects).values({
    userId: "user_test",
    mediaKey: "user_test/import.mp4",
    purpose: "import",
    state: "active",
  });
});
afterAll(async () => {
  await client.close();
});
async function discover() {
  await saveAutomationRule("user_test", input, now);
  const [rule] = await claimAutomationRules(3, now);
  await finishAutomationScan(
    rule,
    { posts: [post()], cursor: "next-page" },
    now,
  );
  return rule;
}

it("persists a paused setup and rejects a stale editor without losing saved options", async () => {
  const settings = { ...DEFAULT_AUTOMATION_SETTINGS, stripHashtags: false };
  const saved = await saveAutomationRule(
    "user_test",
    { ...input, enabled: false, settings },
    now,
  );
  expect((await getAutomation("user_test")).rule).toMatchObject({
    id: saved.id,
    version: 1,
    enabled: false,
    settings,
  });
  expect((await getAutomation("user_other")).rule).toBeNull();
  await expect(saveAutomationRule("user_test", input, now)).rejects.toThrow(
    "automation_changed",
  );
  expect(await claimAutomationRules(3, now)).toEqual([]);
});
it("detects only videos posted after enabling, and inserts repeated page results only once", async () => {
  await saveAutomationRule("user_test", input, now);
  const [rule] = await claimAutomationRules(3, now);
  expect(
    await finishAutomationScan(
      rule,
      { posts: [post(), post(), post("old", new Date(0))], cursor: "next" },
      now,
    ),
  ).toBe(1);
  const state = await getAutomation("user_test");
  expect(state.runs).toHaveLength(1);
  expect(state.rule).toMatchObject({ scanCursor: "next", lastCheckedAt: now });
  const [later] = await claimAutomationRules(
    3,
    new Date(now.getTime() + 6 * 60_000),
  );
  expect(
    await finishAutomationScan(later, { posts: [post()], cursor: null }),
  ).toBe(0);
});
it("discards a late scan after its saved rule changed", async () => {
  await saveAutomationRule("user_test", input, now);
  const [rule] = await claimAutomationRules(3, now);
  await saveAutomationRule(
    "user_test",
    { ...input, version: 1, enabled: false },
    now,
  );
  expect(
    await finishAutomationScan(rule, { posts: [post()], cursor: null }),
  ).toBe(0);
  expect((await getAutomation("user_test")).runs).toEqual([]);
});
it("queues one reviewed destination per post atomically, without duplicate deliveries after a replay", async () => {
  await discover();
  const [run] = await claimAutomationRuns(3, now);
  expect(await enqueueAutomationRun(run, "user_test/import.mp4")).toBe(true);
  expect(await enqueueAutomationRun(run, "user_test/import.mp4")).toBe(false);
  const state = await getAutomation("user_test");
  expect(state.runs[0].status).toBe("queued");
  expect(state.schedules).toHaveLength(2);
  expect(
    state.schedules.find((row) => row.platform === "youtube")?.input,
  ).toMatchObject({
    mediaKey: "user_test/import.mp4",
    title: "A new video",
    description: "A new video\nLonger description",
    privacyStatus: "public",
  });
  expect(state.schedules.every((row) => row.requestKey === run.id)).toBe(true);
});
it("cannot enqueue after pausing during an import", async () => {
  await discover();
  const [run] = await claimAutomationRuns(3, now);
  await saveAutomationRule(
    "user_test",
    { ...input, enabled: false, version: 1 },
    now,
  );
  expect(await enqueueAutomationRun(run, "user_test/import.mp4")).toBe(false);
  await failAutomationRun(run, "late_failure");
  const state = await getAutomation("user_test");
  expect(state.runs[0].status).toBe("cancelled");
  expect(state.schedules).toEqual([]);
});
it("pausing cancels waiting deliveries while an already sending destination can finish", async () => {
  await discover();
  const [run] = await claimAutomationRuns(3, now);
  await enqueueAutomationRun(run, "user_test/import.mp4");
  const schedules = (await getAutomation("user_test")).schedules;
  await db
    .update(schema.publishingSchedules)
    .set({ status: "running" })
    .where(eq(schema.publishingSchedules.id, schedules[0].id));
  await saveAutomationRule(
    "user_test",
    { ...input, enabled: false, version: 1 },
    now,
  );
  expect(
    (await getAutomation("user_test")).schedules
      .map((row) => row.status)
      .sort(),
  ).toEqual(["cancelled", "running"]);
});
it("reenabling skips the paused interval and does not replay old imports", async () => {
  await discover();
  await saveAutomationRule(
    "user_test",
    { ...input, enabled: false, version: 1 },
    now,
  );
  const restarted = new Date(now.getTime() + 3600_000);
  await saveAutomationRule("user_test", { ...input, version: 2 }, restarted);
  const [rule] = await claimAutomationRules(3, restarted);
  await finishAutomationScan(rule, {
    posts: [
      post(),
      post("while_paused", new Date(now.getTime() + 60_000)),
      post("fresh", new Date(restarted.getTime() + 1000)),
    ],
    cursor: null,
  });
  const state = await getAutomation("user_test");
  expect(state.runs.map((run) => run.sourcePostId).sort()).toEqual([
    "fresh",
    "new_video",
  ]);
  expect((await claimAutomationRuns()).map((run) => run.sourcePostId)).toEqual([
    "fresh",
  ]);
});
it("recovers an interrupted import using the same run, ignoring a stale worker's failure", async () => {
  await discover();
  const [first] = await claimAutomationRuns(3, now);
  expect(
    await claimAutomationRuns(3, new Date(now.getTime() + 60_000)),
  ).toEqual([]);
  const [recovered] = await claimAutomationRuns(
    3,
    new Date(now.getTime() + 7 * 60_000),
  );
  expect(recovered.id).toBe(first.id);
  expect(recovered.leaseToken).not.toBe(first.leaseToken);
  await failAutomationRun(first, "stale");
  expect((await getAutomation("user_test")).runs[0].status).toBe("importing");
  await failAutomationRun(recovered, "no_source_file");
  await expect(retryAutomationRun("user_other", recovered.id)).rejects.toThrow(
    "automation_paused",
  );
  await retryAutomationRun("user_test", recovered.id);
  expect((await getAutomation("user_test")).runs[0].status).toBe("pending");
});
it("does not mark a run queued when ownership validation fails", async () => {
  await discover();
  const [run] = await claimAutomationRuns(3, now);
  await expect(enqueueAutomationRun(run, "other/video.mp4")).rejects.toThrow(
    "media_unavailable",
  );
  const state = await getAutomation("user_test");
  expect(state.runs[0].status).toBe("importing");
  expect(state.schedules).toEqual([]);
});
