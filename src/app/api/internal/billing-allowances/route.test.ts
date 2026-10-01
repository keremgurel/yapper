import { beforeEach, expect, it, vi } from "vitest";
const refill = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/subscription-allowances", () => ({
  refillAnnualAllowances: refill,
}));
import { GET } from "./route";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});
it("does not run refills without the cron secret", async () => {
  const response = await GET(
    new Request("https://ypr.app/api/internal/billing-allowances"),
  );
  expect(response.status).toBe(401);
  expect(refill).not.toHaveBeenCalled();
});
it("runs an authenticated refill and returns non-cacheable results", async () => {
  refill.mockResolvedValue({ scanned: 1, granted: 1 });
  const response = await GET(
    new Request("https://ypr.app/api/internal/billing-allowances", {
      headers: { authorization: "Bearer test-secret" },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ scanned: 1, granted: 1 });
});
