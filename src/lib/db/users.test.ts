import { beforeEach, describe, expect, it, vi } from "vitest";
import { importedPlatformMedia, submissions } from "./schema";

const deleteObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/r2", () => ({ deleteObject }));

const select = vi.fn(() => ({
  from: (table: unknown) => ({
    where: vi.fn(() => {
      const rows =
        table === submissions
          ? [
              { key: "u/user_test/shared.mp4" },
              { key: "u/user_test/submission.mp4" },
            ]
          : table === importedPlatformMedia
            ? [
                { key: "u/user_test/shared.mp4" },
                { key: "u/user_test/imported.mp4" },
              ]
            : [{ id: "user_test" }];
      return {
        for: vi.fn(() => ({ limit: vi.fn(async () => rows) })),
        then: (resolve: (value: unknown[]) => unknown) => resolve(rows),
      };
    }),
  }),
}));
const deleteWhere = vi.fn(async () => undefined);
const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
const execute = vi.fn(async () => undefined);

vi.mock("./client", () => ({
  getDb: () => ({
    transaction: (callback: (tx: unknown) => unknown) =>
      callback({ select, delete: deleteFrom, execute }),
  }),
}));

import { deleteUser } from "./users";

beforeEach(() => {
  vi.clearAllMocks();
  deleteObject.mockResolvedValue(undefined);
});

describe("deleteUser imported media cleanup", () => {
  it("deletes imported and submission objects once before rows cascade", async () => {
    await deleteUser("user_test");

    expect(deleteObject.mock.calls.map(([key]) => key).sort()).toEqual([
      "u/user_test/imported.mp4",
      "u/user_test/shared.mp4",
      "u/user_test/submission.mp4",
    ]);
    expect(deleteFrom).toHaveBeenCalledOnce();
  });
});
