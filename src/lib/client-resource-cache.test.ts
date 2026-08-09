import { describe, expect, it, vi } from "vitest";
import {
  clearClientResources,
  invalidateClientResource,
  loadClientResource,
  mutateClientResource,
  readClientResource,
} from "@/lib/client-resource-cache";

describe("client resource cache", () => {
  it("deduplicates simultaneous reads and serves the warm value", async () => {
    const key = `test:dedupe:${crypto.randomUUID()}`;
    const loader = vi.fn(async () => ["calendar item"]);

    const [first, second] = await Promise.all([
      loadClientResource(key, loader),
      loadClientResource(key, loader),
    ]);
    const warm = await loadClientResource(key, loader);

    expect(first).toEqual(["calendar item"]);
    expect(second).toBe(first);
    expect(warm).toBe(first);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("keeps optimistic data visible and refreshes after invalidation", async () => {
    const key = `test:mutate:${crypto.randomUUID()}`;
    mutateClientResource(key, [1]);
    mutateClientResource<number[]>(key, (current) => [...(current ?? []), 2]);
    expect(readClientResource(key)).toEqual([1, 2]);

    invalidateClientResource(key);
    const refreshed = await loadClientResource(key, async () => [3]);
    expect(refreshed).toEqual([3]);
  });

  it("clears user-scoped values without breaking subscriptions", () => {
    const key = `test:clear:${crypto.randomUUID()}`;
    mutateClientResource(key, ["private item"]);

    clearClientResources();

    expect(readClientResource(key)).toBeNull();
  });

  it("does not restore an old user's in-flight response after clearing", async () => {
    const key = `test:in-flight-clear:${crypto.randomUUID()}`;
    let finish!: (value: string[]) => void;
    const oldRequest = loadClientResource(
      key,
      () =>
        new Promise<string[]>((resolve) => {
          finish = resolve;
        }),
    );

    clearClientResources();
    finish(["old user's item"]);
    await oldRequest;

    expect(readClientResource(key)).toBeNull();
  });
});
