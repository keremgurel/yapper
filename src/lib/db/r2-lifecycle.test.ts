import { describe, expect, it, vi } from "vitest";
import {
  processR2LifecycleBatch,
  r2RetryDelayMs,
  type R2DeletionClaim,
  type R2LifecycleWorkerDependencies,
} from "./r2-lifecycle";

const claim: R2DeletionClaim = {
  mediaKey: "u/user_test/object.mp4",
  userId: "user_test",
  leaseToken: "00000000-0000-4000-8000-000000000001",
  attempts: 1,
};

function dependencies(
  overrides: Partial<R2LifecycleWorkerDependencies> = {},
): R2LifecycleWorkerDependencies {
  let calls = 0;
  return {
    claim: vi.fn(async () => (calls++ === 0 ? claim : null)),
    remove: vi.fn(async () => undefined),
    complete: vi.fn(async () => true),
    retry: vi.fn(async () => true),
    now: vi.fn(() => new Date("2026-08-13T12:00:00.000Z")),
    tokenFactory: vi.fn(() => claim.leaseToken),
    ...overrides,
  };
}

describe("R2 lifecycle worker", () => {
  it("deletes outside the claim and completes the matching lease", async () => {
    const deps = dependencies();

    const result = await processR2LifecycleBatch({ limit: 4 }, deps);

    expect(result).toEqual({
      claimed: 1,
      deleted: 1,
      retried: 0,
      staleCompletions: 0,
      deadlineReached: false,
    });
    expect(deps.remove).toHaveBeenCalledWith(
      claim.mediaKey,
      expect.any(AbortSignal),
    );
    expect(deps.complete).toHaveBeenCalledWith(
      claim,
      new Date("2026-08-13T12:00:00.000Z"),
    );
    expect(deps.retry).not.toHaveBeenCalled();
  });

  it.each(["NotFound", "NoSuchKey", "404"])(
    "treats %s as an idempotent deletion success",
    async (name) => {
      const error = Object.assign(new Error("gone"), { name });
      const deps = dependencies({
        remove: vi.fn(async () => Promise.reject(error)),
      });

      const result = await processR2LifecycleBatch({}, deps);

      expect(result.deleted).toBe(1);
      expect(deps.complete).toHaveBeenCalledWith(claim, expect.any(Date));
      expect(deps.retry).not.toHaveBeenCalled();
    },
  );

  it("schedules retry for a transient R2 failure", async () => {
    const error = new Error("socket reset");
    const deps = dependencies({
      remove: vi.fn(async () => Promise.reject(error)),
    });

    const result = await processR2LifecycleBatch({}, deps);

    expect(result.retried).toBe(1);
    expect(result.deleted).toBe(0);
    expect(deps.retry).toHaveBeenCalledWith(claim, error, expect.any(Date));
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it("reports a stale lease instead of crediting another worker's completion", async () => {
    const deps = dependencies({ complete: vi.fn(async () => false) });

    const result = await processR2LifecycleBatch({}, deps);

    expect(result.staleCompletions).toBe(1);
    expect(result.deleted).toBe(0);
  });

  it("stops before claiming when its deadline is exhausted", async () => {
    const deps = dependencies();
    const result = await processR2LifecycleBatch(
      { deadlineAt: new Date("2026-08-13T11:59:59.000Z").getTime() },
      deps,
    );

    expect(result.deadlineReached).toBe(true);
    expect(result.claimed).toBe(0);
    expect(deps.claim).not.toHaveBeenCalled();
  });
});

describe("R2 lifecycle retry policy", () => {
  it("backs off exponentially and caps at one day", () => {
    expect(r2RetryDelayMs(1)).toBe(60_000);
    expect(r2RetryDelayMs(2)).toBe(120_000);
    expect(r2RetryDelayMs(100)).toBe(24 * 60 * 60 * 1_000);
  });
});
