import { beforeEach, describe, expect, it, vi } from "vitest";

const videoListStamp = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/publish", () => ({ videoListStamp }));

import { cachedVideoList, clearVideoListCache } from "./video-list-cache";

beforeEach(() => {
  vi.useRealTimers();
  clearVideoListCache();
  videoListStamp.mockReset();
  videoListStamp.mockResolvedValue("conn:acct|2026-09-25");
});

describe("cachedVideoList", () => {
  it("serves a repeat read from cache while the stamp is unchanged", async () => {
    const load = vi.fn(async () => [{ id: "a" }]);
    await cachedVideoList("user_a", "youtube", load);
    const again = await cachedVideoList("user_a", "youtube", load);
    expect(again).toEqual([{ id: "a" }]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("reloads after a Yapper publish moves the stamp", async () => {
    const load = vi.fn(async () => [{ id: "a" }]);
    await cachedVideoList("user_a", "youtube", load);
    videoListStamp.mockResolvedValue("conn:acct|2026-09-25T10:00");
    await cachedVideoList("user_a", "youtube", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("reloads once the entry is older than the TTL", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => [{ id: "a" }]);
    await cachedVideoList("user_a", "instagram", load);
    vi.advanceTimersByTime(61_000);
    await cachedVideoList("user_a", "instagram", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("skips the cache when a fresh list is asked for", async () => {
    const load = vi.fn(async () => [{ id: "a" }]);
    await cachedVideoList("user_a", "tiktok", load);
    await cachedVideoList("user_a", "tiktok", load, { fresh: true });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps users and platforms apart", async () => {
    const load = vi.fn(async () => [{ id: "a" }]);
    await cachedVideoList("user_a", "youtube", load);
    await cachedVideoList("user_b", "youtube", load);
    await cachedVideoList("user_a", "tiktok", load);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("shares one provider call between concurrent reads", async () => {
    const load = vi.fn(async () => [{ id: "a" }]);
    await Promise.all([
      cachedVideoList("user_a", "youtube", load),
      cachedVideoList("user_a", "youtube", load),
    ]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("never caches a failure", async () => {
    const load = vi
      .fn<() => Promise<{ id: string }[]>>()
      .mockRejectedValueOnce(new Error("provider_down"))
      .mockResolvedValue([{ id: "a" }]);
    await expect(cachedVideoList("user_a", "youtube", load)).rejects.toThrow(
      "provider_down",
    );
    await expect(cachedVideoList("user_a", "youtube", load)).resolves.toEqual([
      { id: "a" },
    ]);
  });
});
