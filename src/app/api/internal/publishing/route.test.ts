import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runDuePublishing } from "@/lib/publish/schedule-runner";
import { GET } from "./route";
vi.mock("@/lib/publish/schedule-runner", () => ({ runDuePublishing: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-worker-key");
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "1");
});
afterEach(() => vi.unstubAllEnvs());
const request = (token = "") =>
  new Request("https://test/internal/publishing", {
    headers: { Authorization: token },
  });
it("requires the cron secret before claiming anything", async () => {
  expect((await GET(request())).status).toBe(401);
  expect((await GET(request("Bearer wrong-worker"))).status).toBe(401);
  expect(runDuePublishing).not.toHaveBeenCalled();
});
it("does no work when disabled", async () => {
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "0");
  expect(
    await (await GET(request("Bearer test-worker-key"))).json(),
  ).toMatchObject({ enabled: false, claimed: 0 });
  expect(runDuePublishing).not.toHaveBeenCalled();
});
it("also lets the publish clock in with its own secret", async () => {
  vi.stubEnv("PUBLISH_SCHEDULER_SECRET", "clock-key");
  vi.mocked(runDuePublishing).mockResolvedValue({
    reconciled: 0,
    claimed: 0,
    settled: 0,
    deferred: 0,
    nextDueAt: null,
  });
  expect((await GET(request("Bearer clock-key"))).status).toBe(200);
  expect((await GET(request("Bearer test-worker-key"))).status).toBe(200);
  expect((await GET(request("Bearer clock-key2"))).status).toBe(401);
});
it("runs the protected due worker when enabled", async () => {
  vi.mocked(runDuePublishing).mockResolvedValue({
    reconciled: 0,
    claimed: 2,
    settled: 2,
    deferred: 0,
    nextDueAt: "2026-10-28T09:00:00.000Z",
  });
  expect(
    await (await GET(request("Bearer test-worker-key"))).json(),
  ).toMatchObject({
    claimed: 2,
    settled: 2,
    nextDueAt: "2026-10-28T09:00:00.000Z",
  });
  expect(runDuePublishing).toHaveBeenCalledTimes(1);
});
