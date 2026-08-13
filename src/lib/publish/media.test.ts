import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getOwnedMediaKey: vi.fn(),
  isActiveR2Object: vi.fn(),
}));

vi.mock("@/lib/db/submissions", () => ({
  getOwnedMediaKey: mocks.getOwnedMediaKey,
}));
vi.mock("@/lib/db/r2-lifecycle", () => ({
  isActiveR2Object: mocks.isActiveR2Object,
}));

import { resolveOwnedMediaKey } from "./media";

describe("resolveOwnedMediaKey", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an active object owned by the caller", async () => {
    mocks.isActiveR2Object.mockResolvedValue(true);

    await expect(
      resolveOwnedMediaKey("user_a", { mediaKey: "u/user_a/video.mp4" }),
    ).resolves.toEqual({ ok: true, mediaKey: "u/user_a/video.mp4" });
    expect(mocks.isActiveR2Object).toHaveBeenCalledWith(
      "user_a",
      "u/user_a/video.mp4",
    );
  });

  it("rejects a tombstoned object even when its prefix looks owned", async () => {
    mocks.isActiveR2Object.mockResolvedValue(false);

    await expect(
      resolveOwnedMediaKey("user_a", { mediaKey: "u/user_a/deleted.mp4" }),
    ).resolves.toEqual({
      ok: false,
      error: "media_unavailable",
      status: 409,
    });
  });

  it("rejects another user's key without querying lifecycle state", async () => {
    await expect(
      resolveOwnedMediaKey("user_a", { mediaKey: "u/user_b/video.mp4" }),
    ).resolves.toEqual({ ok: false, error: "forbidden", status: 403 });
    expect(mocks.isActiveR2Object).not.toHaveBeenCalled();
  });

  it("resolves submission ownership before checking lifecycle state", async () => {
    mocks.getOwnedMediaKey.mockResolvedValue("u/user_a/submission.mp4");
    mocks.isActiveR2Object.mockResolvedValue(true);

    await expect(
      resolveOwnedMediaKey("user_a", { submissionId: "submission-id" }),
    ).resolves.toEqual({
      ok: true,
      mediaKey: "u/user_a/submission.mp4",
    });
  });
});
