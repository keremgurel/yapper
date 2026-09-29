import { describe, expect, it, vi } from "vitest";
import { reconcileR2Inventory } from "./r2-reconciliation";

const now = Date.parse("2026-09-29T12:00:00Z");
const old = (key: string) => ({
  key,
  modifiedAt: new Date(now - 3 * 86_400_000),
  bytes: 100,
});
function dependencies(objects = [old("u/user_test/old.mp4")], hasMore = false) {
  return {
    now: () => now,
    list: vi.fn().mockResolvedValue({ objects, hasMore }),
    readCursor: vi.fn().mockResolvedValue("u/user_test/earlier.mp4"),
    writeCursor: vi.fn().mockResolvedValue(undefined),
    queue: vi.fn().mockResolvedValue(true),
  };
}

describe("bounded R2 inventory reconciliation", () => {
  it("also recovers abandoned transcription scratch files", async () => {
    const deps = dependencies([old("asr/user_test/expired.m4a")]);
    await reconcileR2Inventory(now + 1000, deps);
    expect(deps.queue).toHaveBeenCalledWith(
      "user_test",
      "asr/user_test/expired.m4a",
      100,
      new Date(now),
    );
  });
  it("resumes from the saved cursor and resets only after completing the bucket", async () => {
    const deps = dependencies();
    expect(await reconcileR2Inventory(now + 1000, deps)).toMatchObject({
      scanned: 1,
      enqueued: 1,
      bytesQueued: 100,
      complete: true,
    });
    expect(deps.list).toHaveBeenCalledWith("u/user_test/earlier.mp4");
    expect(deps.writeCursor).toHaveBeenCalledWith(null);
  });
  it("keeps the last examined key when another page exists", async () => {
    const deps = dependencies(undefined, true);
    await reconcileR2Inventory(now + 1000, deps);
    expect(deps.writeCursor).toHaveBeenCalledWith("u/user_test/old.mp4");
  });
  it("never adopts fresh uploads, unknown prefixes, or unsafe sizes", async () => {
    const deps = dependencies([
      { ...old("u/user_test/fresh.mp4"), modifiedAt: new Date(now) },
      old("other/user_test/unknown.mp4"),
      old("u/user_test/nested/file.mp4"),
      { ...old("u/user_test/bad.mp4"), bytes: -1 },
    ]);
    await reconcileR2Inventory(now + 1000, deps);
    expect(deps.queue).not.toHaveBeenCalled();
  });
  it("stops at its deadline without skipping unexamined objects", async () => {
    const deps = dependencies();
    await reconcileR2Inventory(now, deps);
    expect(deps.queue).not.toHaveBeenCalled();
    expect(deps.writeCursor).toHaveBeenCalledWith("u/user_test/earlier.mp4");
  });
  it("does not advance its cursor after a reference check fails", async () => {
    const deps = dependencies();
    deps.queue.mockRejectedValueOnce(new Error("database offline"));
    await expect(reconcileR2Inventory(now + 1000, deps)).rejects.toThrow(
      "database offline",
    );
    expect(deps.writeCursor).not.toHaveBeenCalled();
  });
});
