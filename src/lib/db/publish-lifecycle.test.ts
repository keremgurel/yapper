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

import { claimPublishJob } from "./publish";

function fakeClaimDatabase(options: {
  existing?: {
    id: string;
    status: "uploading" | "published" | "failed";
    externalPostId: string | null;
    externalUrl: string | null;
  };
  objectState?: string;
}) {
  const inserted: Array<Record<string, unknown>> = [];
  const tx = {
    select: vi
      .fn()
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            limit: vi
              .fn()
              .mockResolvedValue(options.existing ? [options.existing] : []),
          }),
        }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({
          where: () => ({
            for: () => ({
              limit: vi
                .fn()
                .mockResolvedValue(
                  options.objectState ? [{ state: options.objectState }] : [],
                ),
            }),
          }),
        }),
      })),
    insert: vi.fn(() => ({
      values: vi.fn((value: Record<string, unknown>) => {
        inserted.push(value);
        return { returning: vi.fn().mockResolvedValue([{ id: "job-new" }]) };
      }),
    })),
  };
  mocks.getDb.mockReturnValue({
    transaction: (run: (value: typeof tx) => unknown) => run(tx),
  });
  return { tx, inserted };
}

describe("claimPublishJob idempotency", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the durable prior state without touching media or inserting", async () => {
    const { tx, inserted } = fakeClaimDatabase({
      existing: {
        id: "job-existing",
        status: "published",
        externalPostId: "post_1",
        externalUrl: "https://platform/post_1",
      },
    });

    await expect(
      claimPublishJob("user_a", {
        platform: "youtube",
        mediaKey: "u/user_a/video.mp4",
        idempotencyKey: "attempt_1234",
      }),
    ).resolves.toEqual({
      kind: "existing",
      jobId: "job-existing",
      status: "published",
      externalPostId: "post_1",
      externalUrl: "https://platform/post_1",
    });
    expect(mocks.lockMediaReferenceWithinTx).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
    expect(inserted).toHaveLength(0);
  });

  it.each(["active", "delete_pending"])(
    "persists the key while the object is %s",
    async (objectState) => {
      const { tx, inserted } = fakeClaimDatabase({ objectState });

      await expect(
        claimPublishJob("user_a", {
          platform: "instagram",
          mediaKey: "u/user_a/video.mp4",
          idempotencyKey: "attempt_1234",
        }),
      ).resolves.toEqual({ kind: "created", jobId: "job-new" });
      expect(mocks.lockStorageUserWithinTx).toHaveBeenCalledWith(tx, "user_a");
      expect(mocks.lockMediaReferenceWithinTx).toHaveBeenCalledWith(
        tx,
        "user_a",
        "u/user_a/video.mp4",
      );
      expect(inserted[0]).toMatchObject({
        platform: "instagram",
        idempotencyKey: "attempt_1234",
        status: "uploading",
      });
    },
  );

  it.each([undefined, "pending_upload", "deleting", "deleted"])(
    "refuses an unavailable lifecycle state (%s)",
    async (objectState) => {
      const { inserted } = fakeClaimDatabase({ objectState });

      await expect(
        claimPublishJob("user_a", {
          platform: "youtube",
          mediaKey: "u/user_a/video.mp4",
          idempotencyKey: "attempt_1234",
        }),
      ).resolves.toEqual({ kind: "unavailable" });
      expect(inserted).toHaveLength(0);
    },
  );
});
