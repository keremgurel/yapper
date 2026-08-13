import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DbTx } from "./client";
import {
  ImportedMediaQuotaError,
  invalidateMissingImportedMedia,
  reconcileImportedMediaBytes,
  registerImportedMedia,
} from "./imported-media";

const events: string[] = [];
const activateObjectWithinTx = vi.hoisted(() => vi.fn());
const markObjectMissingWithinTx = vi.hoisted(() => vi.fn());
vi.mock("./r2-lifecycle", () => ({
  activateObjectWithinTx,
  markObjectMissingWithinTx,
}));
const existingRows: unknown[][] = [];
let quotaRows: unknown[] = [{ id: "user_test" }];

const selectWhere = vi.fn(() => {
  const rows = existingRows.shift() ?? [];
  return {
    limit: vi.fn(async () => rows),
    then: (
      resolve: (value: unknown[]) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(resolve, reject),
  };
});
const from = vi.fn(() => ({ where: selectWhere }));
const select = vi.fn(() => ({ from }));
const returning = vi.fn(async () => {
  events.push("quota");
  return quotaRows;
});
const updateWhere = vi.fn(() => ({ returning }));
const set = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set }));
const deleteWhere = vi.fn(async () => undefined);
const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
const values = vi.fn(async () => {
  events.push("insert");
});
const insert = vi.fn(() => ({ values }));
const execute = vi.fn(async () => {
  events.push("lock");
});

const tx = {
  execute,
  select,
  update,
  insert,
  delete: deleteFrom,
} as unknown as DbTx;
const transaction = vi.fn(async (callback: (tx: DbTx) => unknown) =>
  callback(tx),
);

vi.mock("./client", () => ({
  getDb: () => ({ transaction }),
}));

beforeEach(() => {
  events.length = 0;
  existingRows.length = 0;
  quotaRows = [{ id: "user_test" }];
  vi.clearAllMocks();
  activateObjectWithinTx.mockImplementation(async () => {
    events.push("activate");
  });
  markObjectMissingWithinTx.mockResolvedValue(undefined);
});

describe("registerImportedMedia", () => {
  it("locks, conditionally claims quota, and inserts in one transaction", async () => {
    const result = await registerImportedMedia(
      "user_test",
      "instagram",
      "post_1",
      "u/user_test/attempt.mp4",
      128,
      "A reel",
      1_000,
    );

    expect(result).toMatchObject({
      kind: "inserted",
      mediaKey: "u/user_test/attempt.mp4",
      mediaBytes: 128,
    });
    expect(events).toEqual(["lock", "quota", "insert", "activate"]);
    expect(transaction).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_test",
        externalPostId: "post_1",
        mediaBytes: 128,
      }),
    );
    expect(activateObjectWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "u/user_test/attempt.mp4",
      128,
      "import",
    );
  });

  it("returns the winner without consuming quota for a concurrent loser", async () => {
    existingRows.push([
      {
        mediaKey: "u/user_test/winner.mp4",
        mediaBytes: 128,
        title: "Winner",
      },
    ]);

    const result = await registerImportedMedia(
      "user_test",
      "instagram",
      "post_1",
      "u/user_test/loser.mp4",
      128,
      "Loser",
      1_000,
    );

    expect(result).toEqual({
      kind: "existing",
      mediaKey: "u/user_test/winner.mp4",
      mediaBytes: 128,
      title: "Winner",
    });
    expect(events).toEqual(["lock"]);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails before insertion when the conditional quota claim loses", async () => {
    quotaRows = [];

    await expect(
      registerImportedMedia(
        "user_test",
        "instagram",
        "post_1",
        "u/user_test/attempt.mp4",
        128,
        "A reel",
        100,
      ),
    ).rejects.toBeInstanceOf(ImportedMediaQuotaError);

    expect(events).toEqual(["lock", "quota"]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects invalid byte counts before opening a transaction", async () => {
    await expect(
      registerImportedMedia(
        "user_test",
        "instagram",
        "post_1",
        "u/user_test/attempt.mp4",
        0,
        "A reel",
        1_000,
      ),
    ).rejects.toThrow("invalid imported media size");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("invalidateMissingImportedMedia", () => {
  it("locks the user and object, removes every dead reference, and refunds once", async () => {
    existingRows.push(
      [{ id: "import_1", mediaBytes: 128 }],
      [
        { id: "import_1", mediaBytes: 128 },
        { id: "import_2", mediaBytes: 128 },
      ],
      [{ mediaBytes: 128 }],
    );

    await expect(
      invalidateMissingImportedMedia(
        "user_test",
        "instagram",
        "post_1",
        "u/user_test/missing.mp4",
      ),
    ).resolves.toBe(true);

    expect(events.filter((event) => event === "lock")).toHaveLength(2);
    expect(deleteFrom).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledTimes(2);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ mediaKey: null, mediaBytes: 0 }),
    );
    expect(markObjectMissingWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "u/user_test/missing.mp4",
      "head_object_missing",
    );
  });

  it("does nothing when the exact cache row changed before invalidation", async () => {
    existingRows.push([]);

    await expect(
      invalidateMissingImportedMedia(
        "user_test",
        "instagram",
        "post_1",
        "u/user_test/stale.mp4",
      ),
    ).resolves.toBe(false);

    expect(deleteFrom).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});

describe("reconcileImportedMediaBytes", () => {
  it("returns an already verified row without touching accounting", async () => {
    existingRows.push([
      {
        id: "import_1",
        mediaKey: "u/user_test/clip.mp4",
        mediaBytes: 128,
        title: "Verified",
      },
    ]);

    await expect(
      reconcileImportedMediaBytes(
        "user_test",
        "instagram",
        "post_1",
        "u/user_test/clip.mp4",
        128,
        1_000,
      ),
    ).resolves.toMatchObject({ mediaBytes: 128, title: "Verified" });

    expect(events).toEqual(["lock", "lock", "activate"]);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a legacy byte claim that cannot fit atomically", async () => {
    existingRows.push(
      [
        {
          id: "import_1",
          mediaKey: "u/user_test/clip.mp4",
          mediaBytes: 0,
          title: "Legacy",
        },
      ],
      [],
    );
    quotaRows = [];

    await expect(
      reconcileImportedMediaBytes(
        "user_test",
        "instagram",
        "post_1",
        "u/user_test/clip.mp4",
        128,
        100,
      ),
    ).rejects.toBeInstanceOf(ImportedMediaQuotaError);

    expect(events).toEqual(["lock", "lock", "quota"]);
  });
});
