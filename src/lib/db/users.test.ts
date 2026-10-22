import { beforeEach, describe, expect, it, vi } from "vitest";
import { users, platformConnections } from "./schema";

const revokeGoogleToken = vi.hoisted(() => vi.fn());
const credentials = vi.hoisted(() => ({
  value: null as null | { accessTokenEnc: string; refreshTokenEnc: string },
}));
vi.mock("@/lib/publish/oauth/google-revoke", () => ({ revokeGoogleToken }));
vi.mock("@/lib/publish/tokens", () => ({
  decryptToken: (value: string) => value,
}));
const enqueueAllUserObjectsWithinTx = vi.hoisted(() => vi.fn());
vi.mock("./r2-lifecycle", () => ({ enqueueAllUserObjectsWithinTx }));

const select = vi.fn(() => ({
  from: (table: unknown) => ({
    where: vi.fn(() => {
      const rows =
        table === users
          ? [{ id: "user_test" }]
          : table === platformConnections && credentials.value
            ? [credentials.value]
            : [];
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
  credentials.value = null;
  revokeGoogleToken.mockResolvedValue(undefined);
  enqueueAllUserObjectsWithinTx.mockResolvedValue(undefined);
});

describe("deleteUser object lifecycle cleanup", () => {
  it("durably enqueues all account objects before rows cascade", async () => {
    await deleteUser("user_test");

    expect(enqueueAllUserObjectsWithinTx).toHaveBeenCalledWith(
      expect.any(Object),
      "user_test",
      "account_deleted",
    );
    expect(deleteFrom).toHaveBeenCalledOnce();
  });

  it("does not delete the account when cleanup enqueue fails", async () => {
    enqueueAllUserObjectsWithinTx.mockRejectedValue(
      new Error("enqueue_failed"),
    );

    await expect(deleteUser("user_test")).rejects.toThrow("enqueue_failed");
    expect(deleteFrom).not.toHaveBeenCalled();
  });
});

it("revokes Google before account deletion and keeps the webhook retryable on failure", async () => {
  credentials.value = { accessTokenEnc: "access", refreshTokenEnc: "refresh" };
  revokeGoogleToken.mockRejectedValue(new Error("google-unavailable"));
  await expect(deleteUser("user_test")).rejects.toThrow("google-unavailable");
  expect(deleteFrom).not.toHaveBeenCalled();
  expect(revokeGoogleToken).toHaveBeenCalledWith("refresh");
});
