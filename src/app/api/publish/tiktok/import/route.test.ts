import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NoConnectionError extends Error {}
  class ImportedMediaQuotaError extends Error {}
  class InstagramClipTooLargeError extends Error {}
  class InstagramDownloadTimeoutError extends Error {}
  class R2PendingAllocationLimitError extends Error {}
  class R2PendingStorageQuotaError extends Error {}
  class R2ObjectOwnerMissingError extends Error {}
  return {
    NoConnectionError,
    ImportedMediaQuotaError,
    InstagramClipTooLargeError,
    InstagramDownloadTimeoutError,
    R2PendingAllocationLimitError,
    R2PendingStorageQuotaError,
    R2ObjectOwnerMissingError,
    auth: vi.fn(),
    canUsePremium: vi.fn(),
    clipCleanup: vi.fn(),
    allocatePendingObject: vi.fn(),
    enqueueObjectDeletion: vi.fn(),
    downloadInstagramClip: vi.fn(),
    ensureUser: vi.fn(),
    fetchInstagramMediaForImport: vi.fn(),
    getFreshAccessToken: vi.fn(),
    guardProviderSpend: vi.fn(),
    guardProviderIngress: vi.fn(),
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
    fetchTikTokMediaForImport: vi.fn(),
    resolveDirectTikTokSource: vi.fn(),
    resolveTikTokImportSource: vi.fn(),
    guardTikTokImportSpend: vi.fn(),
  };
});

const posterSlot = vi.hoisted(() => ({
  findWaitingPosterVideo: vi.fn(async () => null as unknown),
  countScheduledVideos: vi.fn(async () => 0),
}));
vi.mock("@/lib/db/poster-slot", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/db/poster-slot")>()),
  ...posterSlot,
  MAX_SCHEDULED_VIDEOS: 10,
  posterSlotBusyResponse: (waiting: unknown) =>
    Response.json({ error: "poster_slot_busy", waiting }, { status: 409 }),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/gate", () => ({
  canUsePremium: mocks.canUsePremium,
}));
vi.mock("@/lib/db/billing", () => ({
  getStorageQuota: mocks.getStorageQuota,
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/db/r2-lifecycle", () => ({
  allocatePendingObject: mocks.allocatePendingObject,
  enqueueObjectDeletion: mocks.enqueueObjectDeletion,
  R2ObjectOwnerMissingError: mocks.R2ObjectOwnerMissingError,
  R2PendingAllocationLimitError: mocks.R2PendingAllocationLimitError,
  R2PendingStorageQuotaError: mocks.R2PendingStorageQuotaError,
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
  headObjectBytes: mocks.headObjectBytes,
  mediaKey: (userId: string, id: string, ext: string) =>
    `u/${userId}/${id}.${ext}`,
  putObjectFile: mocks.putObjectFile,
  r2Configured: mocks.r2Configured,
}));

vi.mock("@/lib/publish/tiktok-import", () => ({
  fetchTikTokMediaForImport: mocks.fetchTikTokMediaForImport,
  resolveDirectTikTokSource: mocks.resolveDirectTikTokSource,
  resolveTikTokImportSource: mocks.resolveTikTokImportSource,
  TIKTOK_MEDIA_DOMAINS: ["tiktokcdn.com", "api.apify.com"],
  TIKTOK_PUBLIC_MEDIA_DOMAINS: ["tiktokcdn.com"],
  tiktokDownloadHeaders: () => undefined,
}));
vi.mock("@/lib/publish/tiktok-import-budget", () => ({
  guardTikTokImportSpend: mocks.guardTikTokImportSpend,
}));
import { POST } from "./route";

const request = (mediaId = "1234567890123") =>
  new Request("https://ypr.app/api/publish/tiktok/import", {
    method: "POST",
    body: JSON.stringify({ mediaId }),
  });

beforeEach(() => {
  vi.stubEnv("APIFY_TOKEN", "test-token");
  mocks.resolveDirectTikTokSource.mockResolvedValue(null);
  mocks.fetchTikTokMediaForImport.mockResolvedValue({
    title: "My TikTok",
    url: "https://www.tiktok.com/@owner/video/1234567890123",
  });
  mocks.resolveTikTokImportSource.mockResolvedValue(
    "https://v.tiktokcdn.com/file.mp4",
  );
  mocks.guardTikTokImportSpend.mockResolvedValue(null);
  mocks.guardProviderSpend.mockResolvedValue(null);
  mocks.guardProviderIngress.mockResolvedValue(null);
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
  mocks.allocatePendingObject.mockResolvedValue(true);
  mocks.enqueueObjectDeletion.mockResolvedValue(undefined);
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
  mocks.invalidateMissingImportedMedia.mockResolvedValue(true);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  posterSlot.findWaitingPosterVideo.mockResolvedValue(null);
});

describe("TikTok import boundaries", () => {
  it("uses a first-party file without spending Apify budget", async () => {
    mocks.resolveDirectTikTokSource.mockResolvedValue(
      "https://v.tiktokcdn.com/direct.mp4",
    );
    expect((await POST(request())).status).toBe(200);
    expect(mocks.downloadInstagramClip).toHaveBeenCalledOnce();
    expect(mocks.guardTikTokImportSpend).not.toHaveBeenCalled();
    expect(mocks.resolveTikTokImportSource).not.toHaveBeenCalled();
  });
  it("imports a verified own post through the shared storage pipeline", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.getFreshAccessToken).toHaveBeenCalledWith(
      "user_test",
      "tiktok",
      undefined,
    );
    expect(mocks.fetchTikTokMediaForImport).toHaveBeenCalledWith(
      "ig_token",
      "1234567890123",
      expect.any(AbortSignal),
    );
    expect(mocks.guardTikTokImportSpend).toHaveBeenCalledOnce();
    expect(mocks.resolveTikTokImportSource).toHaveBeenCalledOnce();
    expect(mocks.registerImportedMedia).toHaveBeenCalledWith(
      "user_test",
      "tiktok",
      "1234567890123",
      expect.stringContaining("tt-import-"),
      100,
      "My TikTok",
      1000,
    );
  });
  it("reuses stored media without another ownership lookup, rate admission or paid actor", async () => {
    const cached = {
      mediaKey: "u/user_test/cached.mp4",
      mediaBytes: 100,
      title: "Cached",
    };
    mocks.importedMediaForPost.mockResolvedValue(cached);
    mocks.headObjectBytes.mockResolvedValue(100);
    mocks.reconcileImportedMediaBytes.mockResolvedValue(cached);
    expect((await POST(request())).status).toBe(200);
    expect(mocks.fetchTikTokMediaForImport).not.toHaveBeenCalled();
    expect(mocks.guardTikTokImportSpend).not.toHaveBeenCalled();
    expect(mocks.resolveTikTokImportSource).not.toHaveBeenCalled();
  });
  it("rejects somebody else's post before paid admission", async () => {
    mocks.fetchTikTokMediaForImport.mockRejectedValue(new Error("not_owned"));
    expect((await POST(request())).status).toBe(403);
    expect(mocks.guardTikTokImportSpend).not.toHaveBeenCalled();
    expect(mocks.resolveTikTokImportSource).not.toHaveBeenCalled();
  });
  it("rejects a full waiting slot before looking up or paying for a video", async () => {
    posterSlot.findWaitingPosterVideo.mockResolvedValue({
      kind: "upload",
      id: "waiting",
      title: "Waiting",
    });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.fetchTikTokMediaForImport).not.toHaveBeenCalled();
    expect(mocks.resolveTikTokImportSource).not.toHaveBeenCalled();
  });
  it("never calls Apify or storage when the shared pacing/budget guard refuses", async () => {
    mocks.guardTikTokImportSpend.mockResolvedValue(
      Response.json({ error: "rate_limited" }, { status: 429 }),
    );
    expect((await POST(request())).status).toBe(429);
    expect(mocks.resolveTikTokImportSource).not.toHaveBeenCalled();
    expect(mocks.putObjectFile).not.toHaveBeenCalled();
  });
  it("checks entitlement and numeric ids before paid work", async () => {
    expect((await POST(request("https://attacker.example"))).status).toBe(400);
    mocks.canUsePremium.mockResolvedValue(false);
    expect((await POST(request())).status).toBe(402);
    expect(mocks.resolveTikTokImportSource).not.toHaveBeenCalled();
  });
});
