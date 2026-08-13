import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class StorageQuotaError extends Error {}
  return {
    StorageQuotaError,
    auth: vi.fn(),
    canUsePremium: vi.fn(),
    activateObjectWithinTx: vi.fn(),
    countMediaOnceWithinTx: vi.fn(),
    lockMediaReferenceWithinTx: vi.fn(),
    lockStorageUserWithinTx: vi.fn(),
    ensureUser: vi.fn(),
    getStorageBytes: vi.fn(),
    getStorageQuota: vi.fn(),
    headObjectBytes: vi.fn(),
    ownsKey: vi.fn(),
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
  activateObjectWithinTx: mocks.activateObjectWithinTx,
}));
vi.mock("@/lib/db/storage-accounting", () => ({
  StorageQuotaError: mocks.StorageQuotaError,
  countMediaOnceWithinTx: mocks.countMediaOnceWithinTx,
  lockMediaReferenceWithinTx: mocks.lockMediaReferenceWithinTx,
  lockStorageUserWithinTx: mocks.lockStorageUserWithinTx,
}));
vi.mock("@/lib/db/users", () => ({
  ensureUser: mocks.ensureUser,
  getStorageBytes: mocks.getStorageBytes,
}));
vi.mock("@/lib/r2", () => ({
  headObjectBytes: mocks.headObjectBytes,
  ownsKey: mocks.ownsKey,
}));

const selectLimit = vi.fn(async () => []);
const dbSelect = vi.fn(() => ({
  from: vi.fn(() => ({ where: vi.fn(() => ({ limit: selectLimit })) })),
}));
const txInsertReturning = vi.fn(async () => [
  {
    id: "submission_test",
    mediaKey: "user_test/clip.mp4",
    createdAt: new Date("2026-08-11T00:00:00.000Z"),
  },
]);
const txInsert = vi.fn(() => ({
  values: vi.fn(() => ({ returning: txInsertReturning })),
}));
const tx = { insert: txInsert };
const transaction = vi.fn(async (callback: (value: typeof tx) => unknown) =>
  callback(tx),
);

vi.mock("@/lib/db/client", () => ({
  getDb: () => ({ select: dbSelect, transaction }),
}));

import { POST } from "./route";

function request(): NextRequest {
  return new Request("https://ypr.app/api/submissions", {
    method: "POST",
    body: JSON.stringify({ mediaKey: "user_test/clip.mp4" }),
    headers: { "content-type": "application/json" },
  }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.getStorageBytes.mockResolvedValue(0);
  mocks.getStorageQuota.mockResolvedValue(1_000_000);
  mocks.headObjectBytes.mockResolvedValue(128);
  mocks.ownsKey.mockReturnValue(true);
  mocks.countMediaOnceWithinTx.mockResolvedValue(undefined);
  mocks.activateObjectWithinTx.mockResolvedValue(undefined);
  mocks.lockMediaReferenceWithinTx.mockResolvedValue(undefined);
  mocks.lockStorageUserWithinTx.mockResolvedValue(undefined);
});

describe("POST /api/submissions atomic storage registration", () => {
  it("inserts and accounts for the reference in one transaction", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(transaction).toHaveBeenCalledOnce();
    expect(mocks.activateObjectWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "user_test/clip.mp4",
      128,
      "recording",
    );
    expect(mocks.countMediaOnceWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "user_test/clip.mp4",
      128,
      "submission_test",
      1_000_000,
    );
    expect(mocks.lockMediaReferenceWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "user_test/clip.mp4",
    );
    expect(mocks.lockStorageUserWithinTx).toHaveBeenCalledWith(tx, "user_test");
  });

  it("does not durably return a submission when accounting fails", async () => {
    mocks.countMediaOnceWithinTx.mockRejectedValue(
      new Error("storage_accounting_failed"),
    );

    await expect(POST(request())).rejects.toThrow("storage_accounting_failed");
    expect(transaction).toHaveBeenCalledOnce();
    expect(txInsertReturning).toHaveBeenCalledOnce();
  });

  it("does not account or return a submission when lifecycle activation fails", async () => {
    mocks.activateObjectWithinTx.mockRejectedValue(
      new Error("r2_object_not_attachable"),
    );

    await expect(POST(request())).rejects.toThrow("r2_object_not_attachable");
    expect(transaction).toHaveBeenCalledOnce();
    expect(txInsertReturning).toHaveBeenCalledOnce();
    expect(mocks.countMediaOnceWithinTx).not.toHaveBeenCalled();
  });
});
