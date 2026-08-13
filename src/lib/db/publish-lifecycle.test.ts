import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  lockStorageUserWithinTx: vi.fn(),
  lockMediaReferenceWithinTx: vi.fn(),
}));

vi.mock("./client", () => ({ getDb: mocks.getDb }));
vi.mock("./storage-accounting", () => ({
  lockStorageUserWithinTx: mocks.lockStorageUserWithinTx,
  lockMediaReferenceWithinTx: mocks.lockMediaReferenceWithinTx,
}));
vi.mock("@/lib/publish/tokens", () => ({
  encryptToken: vi.fn((value: string) => value),
}));

import { createPublishJob } from "./publish";

function fakeDatabase(state: string | undefined) {
  const inserted: Array<Record<string, unknown>> = [];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          for: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue(state ? [{ state }] : []),
          })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        inserted.push(value);
        return {
          returning: vi.fn().mockResolvedValue([{ id: "job-id" }]),
        };
      }),
    })),
  };
  mocks.getDb.mockReturnValue({
    transaction: (run: (value: typeof tx) => unknown) => run(tx),
  });
  return { tx, inserted };
}

describe("createPublishJob lifecycle fencing", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["active", "delete_pending"])(
    "creates a strong publish reference while the object is %s",
    async (state) => {
      const { tx, inserted } = fakeDatabase(state);

      await expect(
        createPublishJob("user_a", {
          platform: "youtube",
          mediaKey: "u/user_a/video.mp4",
        }),
      ).resolves.toBe("job-id");

      expect(mocks.lockStorageUserWithinTx).toHaveBeenCalledWith(tx, "user_a");
      expect(mocks.lockMediaReferenceWithinTx).toHaveBeenCalledWith(
        tx,
        "user_a",
        "u/user_a/video.mp4",
      );
      expect(inserted).toHaveLength(1);
    },
  );

  it.each([undefined, "pending_upload", "deleting", "deleted"])(
    "refuses to publish an unavailable lifecycle state (%s)",
    async (state) => {
      const { tx, inserted } = fakeDatabase(state);

      await expect(
        createPublishJob("user_a", {
          platform: "youtube",
          mediaKey: "u/user_a/video.mp4",
        }),
      ).resolves.toBeNull();
      expect(mocks.lockStorageUserWithinTx).toHaveBeenCalledWith(tx, "user_a");
      expect(inserted).toHaveLength(0);
    },
  );
});
