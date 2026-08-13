import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class R2PendingAllocationLimitError extends Error {}
  class R2PendingStorageQuotaError extends Error {}
  class R2ObjectOwnerMissingError extends Error {}
  return {
    R2PendingAllocationLimitError,
    R2PendingStorageQuotaError,
    R2ObjectOwnerMissingError,
    abandonPendingObject: vi.fn(),
    allocatePendingObject: vi.fn(),
    auth: vi.fn(),
    canUsePremium: vi.fn(),
    getStorageBytes: vi.fn(),
    getStorageQuota: vi.fn(),
    mediaKey: vi.fn(),
    presignUpload: vi.fn(),
    r2Configured: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/gate", () => ({
  canUsePremium: mocks.canUsePremium,
}));
vi.mock("@/lib/db/billing", () => ({
  getStorageQuota: mocks.getStorageQuota,
}));
vi.mock("@/lib/db/r2-lifecycle", () => ({
  abandonPendingObject: mocks.abandonPendingObject,
  allocatePendingObject: mocks.allocatePendingObject,
  R2ObjectOwnerMissingError: mocks.R2ObjectOwnerMissingError,
  R2PendingAllocationLimitError: mocks.R2PendingAllocationLimitError,
  R2PendingStorageQuotaError: mocks.R2PendingStorageQuotaError,
}));
vi.mock("@/lib/db/users", () => ({
  getStorageBytes: mocks.getStorageBytes,
}));
vi.mock("@/lib/r2", () => ({
  mediaKey: mocks.mediaKey,
  presignUpload: mocks.presignUpload,
  r2Configured: mocks.r2Configured,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>): NextRequest {
  return new Request("https://ypr.app/api/media/upload-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.r2Configured.mockReturnValue(true);
  mocks.getStorageBytes.mockResolvedValue(0);
  mocks.getStorageQuota.mockResolvedValue(1_000_000);
  mocks.mediaKey.mockReturnValue("u/user_test/recording.webm");
  mocks.allocatePendingObject.mockResolvedValue(true);
  mocks.abandonPendingObject.mockResolvedValue(true);
  mocks.presignUpload.mockResolvedValue("https://upload.example/signed");
});

describe("POST /api/media/upload-url lifecycle allocation", () => {
  it("requires an explicit supported purpose", async () => {
    const response = await POST(
      request({ sizeBytes: 128, mimeType: "video/webm", ext: "webm" }),
    );

    expect(response.status).toBe(400);
    expect(mocks.allocatePendingObject).not.toHaveBeenCalled();
    expect(mocks.presignUpload).not.toHaveBeenCalled();
  });

  it("rejects a non-image thumbnail", async () => {
    const response = await POST(
      request({
        sizeBytes: 128,
        mimeType: "video/webm",
        ext: "webm",
        purpose: "thumbnail",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.allocatePendingObject).not.toHaveBeenCalled();
  });

  it.each([
    ["recording", "video/webm", 250 * 1024 * 1024 + 1],
    ["thumbnail", "image/png", 20 * 1024 * 1024 + 1],
  ] as const)(
    "rejects an oversized %s before allocating storage",
    async (purpose, mimeType, sizeBytes) => {
      const response = await POST(
        request({ sizeBytes, mimeType, ext: "bin", purpose }),
      );

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual({ error: "media_too_large" });
      expect(mocks.allocatePendingObject).not.toHaveBeenCalled();
      expect(mocks.presignUpload).not.toHaveBeenCalled();
    },
  );

  it("allocates a recording before issuing its presigned PUT", async () => {
    const response = await POST(
      request({
        sizeBytes: 128,
        mimeType: "video/webm",
        ext: "webm",
        purpose: "recording",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.allocatePendingObject).toHaveBeenCalledWith(
      "user_test",
      "u/user_test/recording.webm",
      "recording",
      128,
      1_000_000,
      new Date("2026-08-13T13:00:00.000Z"),
      new Date("2026-08-13T12:30:00.000Z"),
    );
    expect(
      mocks.allocatePendingObject.mock.invocationCallOrder[0],
    ).toBeLessThan(mocks.presignUpload.mock.invocationCallOrder[0]);
    expect(mocks.presignUpload).toHaveBeenCalledWith(
      "u/user_test/recording.webm",
      "video/webm",
      128,
      1_800,
    );
  });

  it("gives thumbnails a hard 24-hour retention window", async () => {
    await POST(
      request({
        sizeBytes: 128,
        mimeType: "image/png",
        ext: "png",
        purpose: "thumbnail",
      }),
    );

    expect(mocks.allocatePendingObject).toHaveBeenCalledWith(
      "user_test",
      "u/user_test/recording.webm",
      "thumbnail",
      128,
      1_000_000,
      new Date("2026-08-14T12:00:00.000Z"),
      new Date("2026-08-13T12:30:00.000Z"),
    );
  });

  it("releases the reservation when presigning fails", async () => {
    mocks.presignUpload.mockRejectedValue(new Error("signing failed"));

    const response = await POST(
      request({
        sizeBytes: 128,
        mimeType: "video/webm",
        ext: "webm",
        purpose: "recording",
      }),
    );

    expect(response.status).toBe(502);
    expect(mocks.abandonPendingObject).toHaveBeenCalledWith(
      "user_test",
      "u/user_test/recording.webm",
      "recording",
    );
  });

  it("rate-limits when the durable pending allocation cap is reached", async () => {
    mocks.allocatePendingObject.mockRejectedValue(
      new mocks.R2PendingAllocationLimitError(),
    );

    const response = await POST(
      request({
        sizeBytes: 128,
        mimeType: "video/webm",
        ext: "webm",
        purpose: "recording",
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "too_many_pending_uploads",
    });
    expect(mocks.presignUpload).not.toHaveBeenCalled();
  });

  it("never presigns when its generated key was already allocated", async () => {
    mocks.allocatePendingObject.mockResolvedValue(false);

    const response = await POST(
      request({
        sizeBytes: 128,
        mimeType: "video/webm",
        ext: "webm",
        purpose: "recording",
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.presignUpload).not.toHaveBeenCalled();
  });

  it.each([
    [mocks.R2PendingStorageQuotaError, 402, "storage_full"],
    [mocks.R2ObjectOwnerMissingError, 409, "user_not_ready"],
  ])("maps atomic allocation failures", async (ErrorType, status, code) => {
    mocks.allocatePendingObject.mockRejectedValue(new ErrorType());

    const response = await POST(
      request({
        sizeBytes: 128,
        mimeType: "video/webm",
        ext: "webm",
        purpose: "recording",
      }),
    );

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error: code });
    expect(mocks.presignUpload).not.toHaveBeenCalled();
  });
});
