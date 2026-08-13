import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processR2LifecycleBatch = vi.hoisted(() => vi.fn());
const cleanupExpiredRateLimitBuckets = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/r2-lifecycle", () => ({ processR2LifecycleBatch }));
vi.mock("@/lib/db/rate-limit", () => ({ cleanupExpiredRateLimitBuckets }));

import { GET } from "./route";

beforeEach(() => {
  process.env.CRON_SECRET = "test-secret";
  processR2LifecycleBatch.mockResolvedValue({ claimed: 0, deleted: 0 });
  cleanupExpiredRateLimitBuckets.mockResolvedValue(3);
});

afterEach(() => {
  delete process.env.CRON_SECRET;
  vi.clearAllMocks();
});

describe("R2 lifecycle cron route", () => {
  it("rejects missing and incorrect credentials", async () => {
    const missing = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle"),
    );
    const wrong = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle", {
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(processR2LifecycleBatch).not.toHaveBeenCalled();
    expect(cleanupExpiredRateLimitBuckets).not.toHaveBeenCalled();
  });

  it("fails closed when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle", {
        headers: { authorization: "Bearer undefined" },
      }),
    );
    expect(response.status).toBe(401);
  });

  it("runs a bounded no-store batch for an authorized request", async () => {
    const before = Date.now();
    const response = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle?limit=999", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(processR2LifecycleBatch).toHaveBeenCalledWith({
      limit: 25,
      deadlineAt: expect.any(Number),
    });
    const [{ deadlineAt }] = processR2LifecycleBatch.mock.calls[0];
    expect(deadlineAt).toBeGreaterThanOrEqual(before + 45_000);
    expect(deadlineAt).toBeLessThanOrEqual(Date.now() + 45_000);
    expect(cleanupExpiredRateLimitBuckets).toHaveBeenCalledWith(500);
    await expect(response.json()).resolves.toMatchObject({
      rateLimitBucketsDeleted: 3,
      rateLimitCleanupFailed: false,
    });
  });

  it("reports cleanup failure without preventing successful R2 work", async () => {
    const error = new Error("cleanup unavailable");
    cleanupExpiredRateLimitBuckets.mockRejectedValue(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const response = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(processR2LifecycleBatch).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      claimed: 0,
      deleted: 0,
      rateLimitBucketsDeleted: 0,
      rateLimitCleanupFailed: true,
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[maintenance] rate-limit cleanup failed",
      error,
    );
  });
});
