import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbTx } from "./client";
import { countMediaOnceWithinTx } from "./storage-accounting";

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
    );

    expect(events).toEqual(["lock", "lookup", "increment"]);
    expect(execute).toHaveBeenCalledOnce();
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
    );

    expect(events).toEqual(["lock", "lookup"]);
    expect(update).not.toHaveBeenCalled();
  });

  it("does no database work for an empty object", async () => {
    await countMediaOnceWithinTx(
      tx,
      "user_test",
      "user_test/empty.webm",
      0,
      "submission_test",
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
      ),
    ).rejects.toThrow("user not found");
  });
});
