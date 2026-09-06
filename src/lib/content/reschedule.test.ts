import { describe, expect, it, vi } from "vitest";
import { createOptimisticUpdater, createRescheduler } from "./reschedule";

function deferred() {
  let resolve!: (value: string) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<string>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("calendar rescheduling", () => {
  it("keeps a confirmed library status and date together when a later edit fails", async () => {
    const initial = { status: "drafting", scheduledFor: null };
    const scheduled = { status: "ready", scheduledFor: "2026-09-06" };
    const recorded = { status: "recorded", scheduledFor: "2026-09-06" };
    const save = vi
      .fn()
      .mockResolvedValueOnce(scheduled)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(recorded);
    const show = vi.fn();
    const failed = vi.fn();
    const update = createOptimisticUpdater<{
      status: string;
      scheduledFor: string | null;
    }>({ save, show, failed, saved: vi.fn() });
    const first = update("item", scheduled, initial);
    const second = update("item", recorded, scheduled);
    await first;
    await expect(second).rejects.toThrow("offline");
    expect(show).toHaveBeenLastCalledWith("item", scheduled);
    await failed.mock.calls[0][1]();
    expect(show).toHaveBeenLastCalledWith("item", recorded);
  });
  it("serializes rapid drags and never rolls back a newer date on an older failure", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue("C");
    const show = vi.fn();
    const failed = vi.fn();
    const move = createRescheduler({ save, show, failed, saved: vi.fn() });
    const b = move("item", "B", "A");
    const c = move("item", "C", "B");
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(1);
    first.reject(new Error("offline"));
    await expect(b).rejects.toThrow("offline");
    await c;
    expect(show.mock.calls.map((call) => call[1])).toEqual(["B", "C", "C"]);
    expect(failed).not.toHaveBeenCalled();
  });

  it("rolls a failed later drag back to the successfully saved intermediate date", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce("B")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce("C");
    const show = vi.fn();
    const failed = vi.fn();
    const move = createRescheduler({ save, show, failed, saved: vi.fn() });
    const b = move("item", "B", "A");
    const c = move("item", "C", "B");
    await b;
    await expect(c).rejects.toThrow("offline");
    expect(show).toHaveBeenLastCalledWith("item", "B");
    await failed.mock.calls[0][1]();
    expect(show).toHaveBeenLastCalledWith("item", "C");
  });

  it("lets different items save independently", async () => {
    const first = deferred();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce("C");
    const move = createRescheduler({
      save,
      show: vi.fn(),
      failed: vi.fn(),
      saved: vi.fn(),
    });
    const a = move("a", "B", "A");
    await move("b", "C", "A");
    expect(save).toHaveBeenCalledTimes(2);
    first.resolve("B");
    await a;
  });
});
