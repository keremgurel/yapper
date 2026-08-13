import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbTx } from "./client";
import {
  countMediaOnceWithinTx,
  StorageQuotaError,
} from "./storage-accounting";

const events: string[] = [];
const execute = vi.fn(async () => {
  events.push("lock");
});
const limit = vi.fn();
const selectWhere = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where: selectWhere }));
const select = vi.fn(() => ({ from }));
const returning = vi.fn();
const updateWhere = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set }));

const tx = { execute, select, update } as unknown as DbTx;

beforeEach(() => {
  events.length = 0;
  vi.clearAllMocks();
  limit.mockImplementation(async () => {
    events.push("lookup");
    return [];
  });
  returning.mockImplementation(async () => {
    events.push("increment");
    return [{ id: "user_test" }];
  });
});

describe("countMediaOnceWithinTx", () => {
  it("locks the user/object pair before checking and incrementing", async () => {
    await countMediaOnceWithinTx(
      tx,
      "user_test",
      "user_test/clip.webm",
      128,
      "submission_test",
      1_000,
    );

    expect(events).toEqual(["lock", "lock", "lookup", "lookup", "increment"]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledOnce();
  });

  it("does not increment when another submission already counted the object", async () => {
    limit.mockImplementation(async () => {
      events.push("lookup");
      return [{ id: "submission_existing" }];
    });

    await countMediaOnceWithinTx(
      tx,
      "user_test",
      "user_test/clip.webm",
      128,
      "submission_test",
      1_000,
    );

    expect(events).toEqual(["lock", "lock", "lookup"]);
    expect(update).not.toHaveBeenCalled();
  });

  it("does not increment when an imported-media row already counted the object", async () => {
    let lookup = 0;
    limit.mockImplementation(async () => {
      events.push("lookup");
      lookup += 1;
      return lookup === 2 ? [{ id: "import_existing", mediaBytes: 128 }] : [];
    });

    await countMediaOnceWithinTx(
      tx,
      "user_test",
      "user_test/imported.mp4",
      128,
      "submission_test",
      1_000,
    );

    expect(events).toEqual(["lock", "lock", "lookup", "lookup"]);
    expect(update).not.toHaveBeenCalled();
  });

  it("claims and marks a legacy zero-byte import when no submission counted it", async () => {
    let lookup = 0;
    limit.mockImplementation(async () => {
      events.push("lookup");
      lookup += 1;
      return lookup === 2 ? [{ id: "import_legacy", mediaBytes: 0 }] : [];
    });

    await countMediaOnceWithinTx(
      tx,
      "user_test",
      "user_test/imported.mp4",
      128,
      "submission_test",
      1_000,
    );

    expect(events).toEqual(["lock", "lock", "lookup", "lookup", "increment"]);
    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenLastCalledWith({ mediaBytes: 128 });
  });

  it("does no database work for an empty object", async () => {
    await countMediaOnceWithinTx(
      tx,
      "user_test",
      "user_test/empty.webm",
      0,
      "submission_test",
      1_000,
    );

    expect(execute).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("fails the surrounding transaction when the owner row is missing", async () => {
    returning.mockResolvedValue([]);

    await expect(
      countMediaOnceWithinTx(
        tx,
        "missing_user",
        "missing_user/clip.webm",
        128,
        "submission_test",
        1_000,
      ),
    ).rejects.toBeInstanceOf(StorageQuotaError);
  });
});
