import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { auth } from "@clerk/nextjs/server";
import {
  createPublishingSchedules,
  findScheduleRequest,
  listPublishingSchedules,
  changePublishingSchedule,
  type PublishingSchedule,
} from "@/lib/db/publishing-schedules";
import { getConnectionRow } from "@/lib/db/publish";
import { resolveOwnedMediaKey } from "@/lib/publish/media";
import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/publishing-schedules", () => ({
  createPublishingSchedules: vi.fn(),
  findScheduleRequest: vi.fn(),
  listPublishingSchedules: vi.fn(),
  changePublishingSchedule: vi.fn(),
  ScheduleConflict: class extends Error {},
}));
vi.mock("@/lib/db/publish", () => ({ getConnectionRow: vi.fn() }));
vi.mock("@/lib/db/content", () => ({ getContentItem: vi.fn() }));
vi.mock("@/lib/db/r2-lifecycle", () => ({ protectPendingThumbnail: vi.fn() }));
vi.mock("@/lib/publish/media", () => ({ resolveOwnedMediaKey: vi.fn() }));
vi.mock("@/lib/r2", () => ({ ownsKey: vi.fn() }));
const row = (): PublishingSchedule => ({
  id: randomUUID(),
  userId: "user_test",
  requestKey: randomUUID(),
  requestHash: "hash",
  entryIndex: 0,
  platform: "youtube",
  externalAccountId: "account",
  accountLabel: "My channel",
  title: "Title",
  contentItemId: null,
  input: { mediaKey: "user_test/video.mp4", title: "Title" },
  scheduledFor: new Date(Date.now() + 3600_000),
  timezone: "UTC",
  status: "scheduled",
  attempt: 0,
  leaseToken: null,
  leaseExpiresAt: null,
  publishJobId: null,
  error: null,
  externalUrl: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const body = () => ({
  requestKey: randomUUID(),
  scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
  timezone: "UTC",
  targets: [
    {
      platform: "youtube",
      expectedAccountId: "account",
      input: { mediaKey: "user_test/video.mp4", title: "Title" },
    },
  ],
});
const request = (value: unknown) =>
  new Request("https://test/schedules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "1");
  vi.stubEnv("CRON_SECRET", "test-only-secret");
  vi.mocked(auth).mockResolvedValue({ userId: "user_test" } as Awaited<
    ReturnType<typeof auth>
  >);
  vi.mocked(findScheduleRequest).mockResolvedValue([]);
  vi.mocked(listPublishingSchedules).mockResolvedValue([]);
  vi.mocked(resolveOwnedMediaKey).mockResolvedValue({
    ok: true,
    mediaKey: "user_test/video.mp4",
  });
  vi.mocked(getConnectionRow).mockResolvedValue({
    externalAccountId: "account",
    handle: "My channel",
    status: "active",
  } as Awaited<ReturnType<typeof getConnectionRow>>);
  vi.mocked(createPublishingSchedules).mockResolvedValue([row()]);
});
afterEach(() => vi.unstubAllEnvs());
it("requires authentication before reading or creating a schedule", async () => {
  vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<
    ReturnType<typeof auth>
  >);
  expect((await GET()).status).toBe(401);
  expect((await POST(request(body()))).status).toBe(401);
  expect(listPublishingSchedules).not.toHaveBeenCalled();
  expect(createPublishingSchedules).not.toHaveBeenCalled();
});
it("rejects arming schedules when the worker is unavailable", async () => {
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "0");
  expect((await POST(request(body()))).status).toBe(503);
  expect(resolveOwnedMediaKey).not.toHaveBeenCalled();
});
it("keeps saved rows visible and cancellable while publishing is paused", async () => {
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "0");
  const saved = row();
  vi.mocked(listPublishingSchedules).mockResolvedValue([saved]);
  vi.mocked(changePublishingSchedule).mockResolvedValue({
    ...saved,
    status: "cancelled",
  });
  const result = await (await GET()).json();
  expect(result.enabled).toBe(false);
  expect(result.schedules).toHaveLength(1);
  expect(result.schedules[0]).not.toHaveProperty("input");
  expect(result.schedules[0]).not.toHaveProperty("externalAccountId");
  expect(
    (
      await PATCH(request({ action: "cancel" }), {
        params: Promise.resolve({ id: saved.id }),
      })
    ).status,
  ).toBe(200);
});
it("tolerates only the missing rollout table, not arbitrary load failures", async () => {
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "0");
  vi.mocked(listPublishingSchedules).mockRejectedValue({
    cause: { code: "42P01" },
  });
  expect(await (await GET()).json()).toEqual({ enabled: false, schedules: [] });
  vi.mocked(listPublishingSchedules).mockRejectedValue(
    new Error("connection_failed"),
  );
  await expect(GET()).rejects.toThrow("connection_failed");
});
it("replays a lost response after the due time before reading source or account again", async () => {
  vi.mocked(findScheduleRequest).mockResolvedValue([row()]);
  expect(
    (await POST(request({ ...body(), scheduledFor: "2020-01-01T00:00:00Z" })))
      .status,
  ).toBe(200);
  expect(resolveOwnedMediaKey).not.toHaveBeenCalled();
  expect(createPublishingSchedules).not.toHaveBeenCalled();
});
it("persists the resolved source and selected account only after all validation", async () => {
  const plan = body();
  expect((await POST(request(plan))).status).toBe(201);
  expect(createPublishingSchedules).toHaveBeenCalledWith(
    "user_test",
    plan.requestKey,
    expect.any(String),
    [
      expect.objectContaining({
        externalAccountId: "account",
        input: expect.objectContaining({
          mediaKey: "user_test/video.mp4",
          title: "Title",
        }),
      }),
    ],
  );
});
it("rejects submission aliases that would schedule the same destination twice", async () => {
  const plan = body();
  const targets = [
    ...plan.targets,
    {
      platform: "youtube",
      expectedAccountId: "account",
      input: { submissionId: randomUUID(), title: "Same video" },
    },
  ];
  expect((await POST(request({ ...plan, targets }))).status).toBe(400);
  expect(createPublishingSchedules).not.toHaveBeenCalled();
});
