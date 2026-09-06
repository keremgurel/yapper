import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { runAutomations } from "@/lib/publish/automation-runner";
import { GET } from "./route";

vi.mock("@/lib/publish/automation-runner", () => ({ runAutomations: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "automation-worker-key");
  vi.stubEnv("STUDIO_SCHEDULER_ENABLED", "1");
  vi.stubEnv("STUDIO_AUTOMATIONS_ENABLED", "1");
});
afterEach(() => vi.unstubAllEnvs());
const request = (token = "") =>
  new Request("https://test/internal/automations", {
    headers: { Authorization: token },
  });
it("rejects unauthenticated workers before discovering or importing posts", async () => {
  expect((await GET(request())).status).toBe(401);
  expect((await GET(request("Bearer wrong-worker"))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(request("Bearer "))).status).toBe(401);
  expect(runAutomations).not.toHaveBeenCalled();
});
it.each(["STUDIO_SCHEDULER_ENABLED", "STUDIO_AUTOMATIONS_ENABLED"])(
  "does no work with %s disabled",
  async (flag) => {
    vi.stubEnv(flag, "0");
    expect(
      await (await GET(request("Bearer automation-worker-key"))).json(),
    ).toEqual({ available: false, checked: 0 });
    expect(runAutomations).not.toHaveBeenCalled();
  },
);
it("passes cancellation through to the enabled worker", async () => {
  vi.mocked(runAutomations).mockResolvedValue({
    checked: 1,
    imported: 1,
    deferred: 0,
  });
  const req = request("Bearer automation-worker-key");
  const response = await GET(req);
  expect(await response.json()).toEqual({
    checked: 1,
    imported: 1,
    deferred: 0,
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(runAutomations).toHaveBeenCalledExactlyOnceWith(req.signal);
});
