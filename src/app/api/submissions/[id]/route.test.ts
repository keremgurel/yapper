import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  deleteObject: vi.fn(),
  lockMediaReferenceWithinTx: vi.fn(),
  lockStorageUserWithinTx: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/r2", () => ({ deleteObject: mocks.deleteObject }));
vi.mock("@/lib/db/storage-accounting", () => ({
  lockMediaReferenceWithinTx: mocks.lockMediaReferenceWithinTx,
  lockStorageUserWithinTx: mocks.lockStorageUserWithinTx,
}));

const queryResults: unknown[][] = [];
const limit = vi.fn(async () => queryResults.shift() ?? []);
const selectWhere = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ where: selectWhere }));
const select = vi.fn(() => ({ from }));
const deleteWhere = vi.fn(async () => undefined);
const deleteFrom = vi.fn(() => ({ where: deleteWhere }));
const updateWhere = vi.fn(async () => undefined);
const set = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set }));
const tx = { select, delete: deleteFrom, update };
type FakeTx = typeof tx;
const transaction = vi.fn(async (callback: (transaction: FakeTx) => unknown) =>
  callback(tx),
);

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({ transaction }),
}));

import { DELETE } from "./route";

const context = { params: Promise.resolve({ id: "submission_test" }) };

beforeEach(() => {
  queryResults.length = 0;
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.deleteObject.mockResolvedValue(undefined);
});

describe("DELETE /api/submissions/[id] storage references", () => {
  it("keeps an object and its accounting while imported media references it", async () => {
    queryResults.push(
      [{ key: "u/user_test/imported.mp4", bytes: 128 }],
      [{ key: "u/user_test/imported.mp4", bytes: 128 }],
      [],
      [{ id: "import_test", mediaBytes: 128 }],
    );

    const response = await DELETE(new Request("https://ypr.app"), context);

    expect(response.status).toBe(200);
    expect(mocks.lockMediaReferenceWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "u/user_test/imported.mp4",
    );
    expect(mocks.lockStorageUserWithinTx).toHaveBeenCalledWith(tx, "user_test");
    expect(update).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("transfers legacy zero-byte accounting to the import row", async () => {
    queryResults.push(
      [{ key: "u/user_test/imported.mp4", bytes: 128 }],
      [{ key: "u/user_test/imported.mp4", bytes: 128 }],
      [],
      [{ id: "import_test", mediaBytes: 0 }],
    );

    const response = await DELETE(new Request("https://ypr.app"), context);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
    expect(set).toHaveBeenCalledWith({ mediaBytes: 128 });
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("refunds and deletes only after the last reference is removed", async () => {
    queryResults.push(
      [{ key: "u/user_test/recording.mp4", bytes: 128 }],
      [{ key: "u/user_test/recording.mp4", bytes: 128 }],
      [],
      [],
    );

    const response = await DELETE(new Request("https://ypr.app"), context);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledOnce();
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      "u/user_test/recording.mp4",
    );
  });
});
