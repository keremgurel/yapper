import { describe, expect, it } from "vitest";
import { failedSaveRetargets } from "@/lib/save-queue";

describe("failedSaveRetargets", () => {
  const saveA = async () => {};
  const saveB = async () => {};

  it("is false when no batch is pending (safe to re-merge and retry)", () => {
    expect(failedSaveRetargets(saveA, null)).toBe(false);
  });

  it("is false when the pending batch is still the same save", () => {
    expect(failedSaveRetargets(saveA, saveA)).toBe(false);
  });

  it("is true when the batch was re-pointed at a different save mid-flight", () => {
    // The caller switched records while saveA was in flight. Re-merging saveA's
    // failed fields into saveB's batch would write them to the wrong record.
    expect(failedSaveRetargets(saveA, saveB)).toBe(true);
  });
});

import { SaveQueue, mergeRecordPatches, retainNewerEdits } from "./save-queue";
import { vi } from "vitest";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("serialized save outcomes", () => {
  it("preserves edits to two fields of the same Knowledge block", async () => {
    const save = vi.fn(async () => {});
    const queue = new SaveQueue<
      Record<string, { body?: string; title?: string }>
    >(() => {}, mergeRecordPatches);
    queue.enqueue({ a: { body: "Keep this" } }, save);
    queue.enqueue({ a: { title: "And this" } }, save);
    await queue.flush();
    expect(save).toHaveBeenCalledWith(
      { a: { body: "Keep this", title: "And this" } },
      undefined,
    );
  });

  it("waits for earlier writes before starting the next batch", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = new SaveQueue<{ voice: string }>(() => {});
    queue.enqueue({ voice: "first" }, save);
    const a = queue.flush();
    queue.enqueue({ voice: "second" }, save);
    const b = queue.flush();
    expect(save).toHaveBeenCalledTimes(1);
    first.resolve();
    await Promise.all([a, b]);
    expect(save.mock.calls.map((call) => call[0])).toEqual([
      { voice: "first" },
      { voice: "second" },
    ]);
  });

  it("rejects a failed command, retains it, and permits an explicit retry", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(undefined);
    const states: string[] = [];
    const queue = new SaveQueue<{ audience: string }>((state) =>
      states.push(state),
    );
    queue.enqueue({ audience: "Creators" }, save);
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(states.at(-1)).toBe("error");
    await queue.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toBe("saved");
  });

  it("settles edits added while a save is in flight before allowing a reload", async () => {
    const first = deferred();
    const second = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const queue = new SaveQueue<{ voice: string }>(() => {});
    queue.enqueue({ voice: "first" }, save);
    let settled = false;
    const done = queue.settle().then(() => {
      settled = true;
    });
    queue.enqueue({ voice: "latest" }, save);
    first.resolve();
    await first.promise;
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(save).toHaveBeenLastCalledWith({ voice: "latest" }, undefined);
    second.resolve();
    await done;
    expect(settled).toBe(true);
  });

  it("carries failed fields into an already queued newer write without reviving stale values", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = new SaveQueue<{ voice: string; audience: string }>(() => {});
    queue.enqueue({ voice: "old", audience: "Creators" }, save);
    const a = queue.flush();
    queue.enqueue({ voice: "new" }, save);
    const b = queue.flush();
    first.reject(new Error("offline"));
    await expect(a).rejects.toThrow("offline");
    await b;
    expect(save.mock.calls[1][0]).toEqual({
      voice: "new",
      audience: "Creators",
    });
    expect(queue.unsent()).toEqual({});
    await queue.flush();
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("merges failed nested fields with edits made while saving", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValue(undefined);
    const queue = new SaveQueue<
      Record<string, { title?: string; body?: string }>
    >(() => {}, mergeRecordPatches);
    queue.enqueue({ a: { body: "new body" } }, save);
    const a = queue.flush();
    queue.enqueue({ a: { title: "new title" } }, save);
    first.reject(new Error("offline"));
    await expect(a).rejects.toThrow("offline");
    await queue.flush();
    expect(save.mock.calls[1][0]).toEqual({
      a: { body: "new body", title: "new title" },
    });
  });

  it("never sends failed fields from one target to a different target", async () => {
    const first = deferred();
    const saveA = vi.fn(() => first.promise);
    const saveB = vi.fn(async () => {});
    const queue = new SaveQueue<{ body: string; title: string }>(() => {});
    queue.enqueue({ body: "private A" }, saveA);
    const a = queue.flush();
    queue.enqueue({ title: "B" }, saveB);
    const b = queue.flush();
    first.reject(new Error("offline"));
    await expect(a).rejects.toThrow("offline");
    await b;
    expect(saveB).toHaveBeenCalledWith({ title: "B" }, undefined);
    expect(queue.unsent()).toEqual({});
  });

  it("retains newer local typing when an earlier project save replies", () => {
    expect(
      retainNewerEdits(
        { voice: "new", audience: "Creators" },
        { voice: "old", audience: "Creators" },
      ),
    ).toEqual({ voice: "new" });
  });
});
