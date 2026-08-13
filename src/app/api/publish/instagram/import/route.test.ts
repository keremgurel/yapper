import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NoConnectionError extends Error {}
  class ImportedMediaQuotaError extends Error {}
  class InstagramClipTooLargeError extends Error {}
  class InstagramDownloadTimeoutError extends Error {}
  return {
    NoConnectionError,
    ImportedMediaQuotaError,
    InstagramClipTooLargeError,
    InstagramDownloadTimeoutError,
    auth: vi.fn(),
    canUsePremium: vi.fn(),
    clipCleanup: vi.fn(),
    deleteObject: vi.fn(),
    downloadInstagramClip: vi.fn(),
    ensureUser: vi.fn(),
    fetchInstagramMediaForImport: vi.fn(),
    getFreshAccessToken: vi.fn(),
    getStorageBytes: vi.fn(),
    getStorageQuota: vi.fn(),
    headObjectBytes: vi.fn(),
    importedMediaForPost: vi.fn(),
    putObjectFile: vi.fn(),
    r2Configured: vi.fn(),
    reconcileImportedMediaBytes: vi.fn(),
    registerImportedMedia: vi.fn(),
    invalidateMissingImportedMedia: vi.fn(),
    resolveInstagramSourceFile: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/gate", () => ({
  canUsePremium: mocks.canUsePremium,
}));
vi.mock("@/lib/db/billing", () => ({
  getStorageQuota: mocks.getStorageQuota,
}));
vi.mock("@/lib/db/imported-media", () => ({
  ImportedMediaQuotaError: mocks.ImportedMediaQuotaError,
  importedMediaForPost: mocks.importedMediaForPost,
  reconcileImportedMediaBytes: mocks.reconcileImportedMediaBytes,
  registerImportedMedia: mocks.registerImportedMedia,
  invalidateMissingImportedMedia: mocks.invalidateMissingImportedMedia,
}));
vi.mock("@/lib/db/users", () => ({
  ensureUser: mocks.ensureUser,
  getStorageBytes: mocks.getStorageBytes,
}));
vi.mock("@/lib/publish/connection", () => ({
  NoConnectionError: mocks.NoConnectionError,
  getFreshAccessToken: mocks.getFreshAccessToken,
}));
vi.mock("@/lib/publish/instagram-import", () => ({
  InstagramClipTooLargeError: mocks.InstagramClipTooLargeError,
  InstagramDownloadTimeoutError: mocks.InstagramDownloadTimeoutError,
  downloadInstagramClip: mocks.downloadInstagramClip,
  fetchInstagramMediaForImport: mocks.fetchInstagramMediaForImport,
}));
vi.mock("@/lib/publish/instagram-source-file", () => ({
  resolveInstagramSourceFile: mocks.resolveInstagramSourceFile,
}));
vi.mock("@/lib/r2", () => ({
  deleteObject: mocks.deleteObject,
  headObjectBytes: mocks.headObjectBytes,
  mediaKey: (userId: string, id: string, ext: string) =>
    `u/${userId}/${id}.${ext}`,
  putObjectFile: mocks.putObjectFile,
  r2Configured: mocks.r2Configured,
}));

import { POST } from "./route";

const request = (mediaId = "ig_123") =>
  new Request("https://ypr.app/api/publish/instagram/import", {
    method: "POST",
    body: JSON.stringify({ mediaId }),
  });

beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.r2Configured.mockReturnValue(true);
  mocks.getStorageQuota.mockResolvedValue(1_000);
  mocks.getStorageBytes.mockResolvedValue(0);
  mocks.importedMediaForPost.mockResolvedValue(null);
  mocks.getFreshAccessToken.mockResolvedValue("ig_token");
  mocks.fetchInstagramMediaForImport.mockResolvedValue({
    mediaUrl: "https://cdn.example/clip.mp4",
    permalink: "https://instagram.com/reel/ig_123",
    title: "Imported reel",
  });
  mocks.resolveInstagramSourceFile.mockResolvedValue(
    "https://cdn.example/clip.mp4",
  );
  mocks.downloadInstagramClip.mockResolvedValue({
    filePath: "/tmp/clip.mp4",
    byteLength: 100,
    contentType: "video/mp4",
    cleanup: mocks.clipCleanup,
  });
  mocks.clipCleanup.mockResolvedValue(undefined);
  mocks.putObjectFile.mockResolvedValue(undefined);
  mocks.registerImportedMedia.mockImplementation(
    async (
      _userId: string,
      _platform: string,
      _postId: string,
      mediaKey: string,
      mediaBytes: number,
      title: string,
    ) => ({ kind: "inserted", mediaKey, mediaBytes, title }),
  );
  mocks.deleteObject.mockResolvedValue(undefined);
  mocks.invalidateMissingImportedMedia.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("POST /api/publish/instagram/import", () => {
  it("checks entitlement before cache or provider work", async () => {
    mocks.canUsePremium.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(402);
    expect(mocks.importedMediaForPost).not.toHaveBeenCalled();
    expect(mocks.getFreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.fetchInstagramMediaForImport).not.toHaveBeenCalled();
  });

  it("rejects a fresh import at quota before provider work", async () => {
    mocks.getStorageBytes.mockResolvedValue(1_000);

    const response = await POST(request());

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({ error: "storage_full" });
    expect(mocks.getFreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.fetchInstagramMediaForImport).not.toHaveBeenCalled();
  });

  it("returns a verified cached object without provider or upload work", async () => {
    const cached = {
      mediaKey: "u/user_test/cached.mp4",
      mediaBytes: 100,
      title: "Cached",
    };
    mocks.importedMediaForPost.mockResolvedValue(cached);
    mocks.headObjectBytes.mockResolvedValue(100);
    mocks.reconcileImportedMediaBytes.mockResolvedValue(cached);

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      mediaKey: cached.mediaKey,
      title: "Cached",
    });
    expect(mocks.reconcileImportedMediaBytes).toHaveBeenCalledWith(
      "user_test",
      "instagram",
      "ig_123",
      cached.mediaKey,
      100,
      1_000,
    );
    expect(mocks.getFreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.putObjectFile).not.toHaveBeenCalled();
  });

  it("removes a stale cache row before performing a fresh import", async () => {
    const cached = {
      mediaKey: "u/user_test/missing.mp4",
      mediaBytes: 100,
      title: "Missing",
    };
    mocks.importedMediaForPost.mockResolvedValue(cached);
    mocks.headObjectBytes.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.invalidateMissingImportedMedia).toHaveBeenCalledWith(
      "user_test",
      "instagram",
      "ig_123",
      cached.mediaKey,
    );
    expect(mocks.fetchInstagramMediaForImport).toHaveBeenCalledOnce();
    expect(mocks.registerImportedMedia).toHaveBeenCalledOnce();
  });

  it("rejects an oversized stream without uploading or registering", async () => {
    mocks.downloadInstagramClip.mockRejectedValue(
      new mocks.InstagramClipTooLargeError(),
    );

    const response = await POST(request());

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "clip_too_large" });
    expect(mocks.putObjectFile).not.toHaveBeenCalled();
    expect(mocks.registerImportedMedia).not.toHaveBeenCalled();
  });

  it("reports a bounded download timeout without uploading", async () => {
    mocks.downloadInstagramClip.mockRejectedValue(
      new mocks.InstagramDownloadTimeoutError(),
    );

    const response = await POST(request());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({
      error: "download_timeout",
    });
    expect(mocks.putObjectFile).not.toHaveBeenCalled();
  });

  it("cleans the temporary file when R2 upload fails", async () => {
    mocks.putObjectFile.mockRejectedValue(new Error("r2_unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "storage_unavailable",
    });
    expect(mocks.clipCleanup).toHaveBeenCalledOnce();
    expect(mocks.registerImportedMedia).not.toHaveBeenCalled();
  });

  it("returns storage_full when cached byte reconciliation exceeds quota", async () => {
    const cached = {
      mediaKey: "u/user_test/legacy.mp4",
      mediaBytes: 0,
      title: "Legacy",
    };
    mocks.importedMediaForPost.mockResolvedValue(cached);
    mocks.headObjectBytes.mockResolvedValue(100);
    mocks.reconcileImportedMediaBytes.mockRejectedValue(
      new mocks.ImportedMediaQuotaError(),
    );

    const response = await POST(request());

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({ error: "storage_full" });
    expect(mocks.getFreshAccessToken).not.toHaveBeenCalled();
  });

  it("reports a bounded provider lookup timeout without downloading", async () => {
    mocks.fetchInstagramMediaForImport.mockRejectedValue(
      new DOMException("timed out", "TimeoutError"),
    );

    const response = await POST(request());

    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toEqual({ error: "import_timeout" });
    expect(mocks.downloadInstagramClip).not.toHaveBeenCalled();
    expect(mocks.putObjectFile).not.toHaveBeenCalled();
  });

  it("deletes only its unique attempt object when quota loses the race", async () => {
    mocks.registerImportedMedia.mockRejectedValue(
      new mocks.ImportedMediaQuotaError(),
    );

    const response = await POST(request());

    expect(response.status).toBe(402);
    const uploadedKey = mocks.putObjectFile.mock.calls[0]?.[0] as string;
    expect(uploadedKey).toMatch(/^u\/user_test\/ig-import-[0-9a-f-]+\.mp4$/);
    expect(mocks.deleteObject).toHaveBeenCalledWith(uploadedKey);
  });

  it("isolates concurrent attempt keys and cleans only the losing object", async () => {
    let winner: string | undefined;
    mocks.registerImportedMedia.mockImplementation(
      async (
        _userId: string,
        _platform: string,
        _postId: string,
        key: string,
      ) => {
        if (!winner) {
          winner = key;
          return {
            kind: "inserted",
            mediaKey: key,
            mediaBytes: 100,
            title: "Imported reel",
          };
        }
        return {
          kind: "existing",
          mediaKey: winner,
          mediaBytes: 100,
          title: "Imported reel",
        };
      },
    );

    const [first, second] = await Promise.all([
      POST(request()),
      POST(request()),
    ]);
    const firstJson = await first.json();
    const secondJson = await second.json();
    const uploadedKeys = mocks.putObjectFile.mock.calls.map(
      ([key]) => key as string,
    );

    expect(new Set(uploadedKeys).size).toBe(2);
    expect(firstJson.mediaKey).toBe(winner);
    expect(secondJson.mediaKey).toBe(winner);
    expect(mocks.deleteObject).toHaveBeenCalledOnce();
    expect(mocks.deleteObject).toHaveBeenCalledWith(
      uploadedKeys.find((key) => key !== winner),
    );
  });

  it("reconciles an ambiguous commit and preserves the durable object", async () => {
    let uploadedKey = "";
    mocks.putObjectFile.mockImplementation(async (key: string) => {
      uploadedKey = key;
    });
    mocks.registerImportedMedia.mockRejectedValue(new Error("connection_lost"));
    mocks.importedMediaForPost
      .mockResolvedValueOnce(null)
      .mockImplementation(async () => ({
        mediaKey: uploadedKey,
        mediaBytes: 100,
        title: "Imported reel",
      }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      mediaKey: uploadedKey,
    });
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("does not delete an attempt when ambiguous-commit reconciliation also fails", async () => {
    mocks.registerImportedMedia.mockRejectedValue(new Error("connection_lost"));
    mocks.importedMediaForPost
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("database_unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("cleans an attempt after a confirmed registration rollback", async () => {
    mocks.registerImportedMedia.mockRejectedValue(new Error("insert_failed"));
    mocks.importedMediaForPost
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(502);
    const uploadedKey = mocks.putObjectFile.mock.calls[0]?.[0] as string;
    expect(mocks.deleteObject).toHaveBeenCalledWith(uploadedKey);
  });
});
