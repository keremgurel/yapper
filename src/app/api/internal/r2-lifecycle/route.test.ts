import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const processR2LifecycleBatch = vi.hoisted(() => vi.fn());
const cleanupExpiredRateLimitBuckets = vi.hoisted(() => vi.fn());
const releaseSupersededMediaBatch = vi.hoisted(() => vi.fn());
const releasePostedMediaBatch = vi.hoisted(() => vi.fn());
const releaseLapsedMediaBatch = vi.hoisted(() => vi.fn());
const reconcileR2Inventory = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/r2-reconciliation", () => ({ reconcileR2Inventory }));
vi.mock("@/lib/db/lapsed-media-retention", () => ({
  releaseLapsedMediaBatch,
}));
vi.mock("@/lib/db/r2-lifecycle", () => ({ processR2LifecycleBatch }));
vi.mock("@/lib/db/posted-media-retention", () => ({
  releasePostedMediaBatch,
  releaseSupersededMediaBatch,
}));
vi.mock("@/lib/db/rate-limit", () => ({ cleanupExpiredRateLimitBuckets }));

import { GET } from "./route";

beforeEach(() => {
  reconcileR2Inventory.mockResolvedValue({
    scanned: 0,
    enqueued: 0,
    bytesQueued: 0,
    complete: true,
  });
  process.env.CRON_SECRET = "test-secret";
  processR2LifecycleBatch.mockResolvedValue({ claimed: 0, deleted: 0 });
  cleanupExpiredRateLimitBuckets.mockResolvedValue(3);
  releaseSupersededMediaBatch.mockResolvedValue({ released: 6, failed: 0 });
  releasePostedMediaBatch.mockResolvedValue({ released: 2, failed: 0 });
  releaseLapsedMediaBatch.mockResolvedValue({
    accounts: 0,
    released: 0,
    failed: 0,
  });
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
      limit: 999,
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

    expect(response.status).toBe(503);
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

  it.each([
    ["supersededMedia", releaseSupersededMediaBatch],
    ["postedMedia", releasePostedMediaBatch],
    ["lapsedMedia", releaseLapsedMediaBatch],
  ] as const)(
    "exposes a failed %s release while continuing deletion",
    async (field, release) => {
      release.mockRejectedValueOnce(new Error("database unavailable"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET(
        new Request("https://example.test/api/internal/r2-lifecycle", {
          headers: { authorization: "Bearer test-secret" },
        }),
      );
      expect(response.status).toBe(503);
      expect(processR2LifecycleBatch).toHaveBeenCalledOnce();
      expect(await response.json()).toMatchObject({ [field]: { failed: 1 } });
    },
  );

  it("reports an R2 deletion retry as an unhealthy cleanup run", async () => {
    processR2LifecycleBatch.mockResolvedValueOnce({
      claimed: 2,
      deleted: 1,
      retried: 1,
    });
    const response = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ deleted: 1, retried: 1 });
  });

  it("still deletes tracked media if the bucket inventory fails", async () => {
    reconcileR2Inventory.mockRejectedValueOnce(new Error("inventory denied"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(response.status).toBe(503);
    expect(processR2LifecycleBatch).toHaveBeenCalledOnce();
    expect(await response.json()).toMatchObject({ inventoryFailed: true });
  });

  it("lets go of posted videos before deleting, and reports it", async () => {
    const response = await GET(
      new Request("https://example.test/api/internal/r2-lifecycle", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );
    expect(releasePostedMediaBatch).toHaveBeenCalledOnce();
    expect(releasePostedMediaBatch.mock.invocationCallOrder[0]).toBeLessThan(
      processR2LifecycleBatch.mock.invocationCallOrder[0],
    );
    expect(await response.json()).toMatchObject({
      postedMedia: { released: 2, failed: 0 },
      supersededMedia: { released: 6, failed: 0 },
    });
  });
});
