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
it("runs the protected due worker when enabled", async () => {
  vi.mocked(runDuePublishing).mockResolvedValue({
    reconciled: 0,
    claimed: 2,
    settled: 2,
    deferred: 0,
  });
  expect(
    await (await GET(request("Bearer test-worker-key"))).json(),
  ).toMatchObject({ claimed: 2, settled: 2 });
  expect(runDuePublishing).toHaveBeenCalledTimes(1);
});
