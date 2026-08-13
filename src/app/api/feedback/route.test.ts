import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class InsufficientCreditsError extends Error {}
  class StorageQuotaError extends Error {}

  return {
    InsufficientCreditsError,
    StorageQuotaError,
    auth: vi.fn(),
    canUsePremium: vi.fn(),
    coachOnCamera: vi.fn(),
    countMediaOnceWithinTx: vi.fn(),
    deleteObject: vi.fn(),
    deductWithinTx: vi.fn(),
    ensureUser: vi.fn(),
    getBalance: vi.fn(),
    getObjectBytes: vi.fn(),
    getStorageBytes: vi.fn(),
    getStorageQuota: vi.fn(),
    ownsKey: vi.fn(),
    uploadBytesToGemini: vi.fn(),
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/gate", () => ({
  canUsePremium: mocks.canUsePremium,
}));
vi.mock("@/lib/db/billing", () => ({
  getStorageQuota: mocks.getStorageQuota,
}));
vi.mock("@/lib/db/credits", () => ({
  deductWithinTx: mocks.deductWithinTx,
  getBalance: mocks.getBalance,
  InsufficientCreditsError: mocks.InsufficientCreditsError,
}));
vi.mock("@/lib/db/storage-accounting", () => ({
  StorageQuotaError: mocks.StorageQuotaError,
  countMediaOnceWithinTx: mocks.countMediaOnceWithinTx,
}));
vi.mock("@/lib/db/users", () => ({
  ensureUser: mocks.ensureUser,
  getStorageBytes: mocks.getStorageBytes,
}));
vi.mock("@/lib/feedback/gemini", () => ({
  uploadBytesToGemini: mocks.uploadBytesToGemini,
}));
vi.mock("@/lib/feedback/video", () => ({
  coachOnCamera: mocks.coachOnCamera,
}));
vi.mock("@/lib/r2", () => ({
  deleteObject: mocks.deleteObject,
  getObjectBytes: mocks.getObjectBytes,
  ownsKey: mocks.ownsKey,
}));
vi.mock("@/lib/feedback/audio", () => ({ runAudioFeedback: vi.fn() }));
vi.mock("@/lib/feedback/metrics", () => ({ computeMetrics: vi.fn() }));
vi.mock("@/lib/feedback/transcribe", () => ({
  transcribeForFeedback: vi.fn(),
}));

interface FakeDbState {
  balance: number;
  completed: boolean;
  failed: boolean;
  ledgerEntries: number;
}

const state: FakeDbState = {
  balance: 100,
  completed: false,
  failed: false,
  ledgerEntries: 0,
};
const tx = { update: vi.fn() };
const db = {
  insert: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
};

vi.mock("@/lib/db/client", () => ({ getDb: () => db }));

import { POST } from "./route";

function videoRequest(): NextRequest {
  return new Request(
    "https://ypr.app/api/feedback?tier=video&mediaKey=user_test/clip.webm",
    { method: "POST" },
  ) as NextRequest;
}

beforeEach(() => {
  state.balance = 100;
  state.completed = false;
  state.failed = false;
  state.ledgerEntries = 0;
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.getBalance.mockResolvedValue(100);
  mocks.ownsKey.mockReturnValue(true);
  mocks.getObjectBytes.mockResolvedValue(new Uint8Array(128).buffer);
  mocks.getStorageBytes.mockResolvedValue(0);
  mocks.getStorageQuota.mockResolvedValue(1_000_000);
  mocks.uploadBytesToGemini.mockResolvedValue("gemini://clip");
  mocks.coachOnCamera.mockResolvedValue({ score: 8 });
  mocks.deductWithinTx.mockImplementation(async () => {
    state.balance -= 5;
    state.ledgerEntries += 1;
    return state.balance;
  });
  mocks.countMediaOnceWithinTx.mockResolvedValue(undefined);

  db.insert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "submission_test" }]),
    }),
  });
  db.update.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockImplementation(async () => {
        state.failed = true;
      }),
    }),
  }));
  tx.update.mockImplementation(() => ({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(async () => {
          state.completed = true;
          return [{ id: "submission_test" }];
        }),
      }),
    }),
  }));
  db.transaction.mockImplementation(async (callback) => {
    const before = { ...state };
    try {
      return await callback(tx);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/feedback atomic completion", () => {
  it("preserves caller-owned media when provider processing fails", async () => {
    mocks.coachOnCamera.mockRejectedValue(new Error("provider_down"));

    const response = await POST(videoRequest());

    expect(response.status).toBe(502);
    expect(state.failed).toBe(true);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("rolls completion back when storage accounting fails", async () => {
    mocks.countMediaOnceWithinTx.mockRejectedValue(
      new Error("storage_counter_failed"),
    );

    const response = await POST(videoRequest());

    expect(response.status).toBe(502);
    expect(state.completed).toBe(false);
    expect(state.failed).toBe(true);
    expect(state.balance).toBe(100);
    expect(state.ledgerEntries).toBe(0);
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
    expect(mocks.countMediaOnceWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "user_test/clip.webm",
      128,
      "submission_test",
      1_000_000,
    );
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("rolls the debit and ledger back when completion cannot be claimed", async () => {
    tx.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }));

    const response = await POST(videoRequest());

    expect(response.status).toBe(502);
    expect(state.balance).toBe(100);
    expect(state.ledgerEntries).toBe(0);
    expect(state.completed).toBe(false);
    expect(state.failed).toBe(true);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("returns 402 without committing when the final debit loses a race", async () => {
    mocks.deductWithinTx.mockRejectedValue(
      new mocks.InsufficientCreditsError("insufficient credits"),
    );

    const response = await POST(videoRequest());

    expect(response.status).toBe(402);
    await expect(response.json()).resolves.toEqual({
      error: "insufficient_credits",
    });
    expect(state.completed).toBe(false);
    expect(state.failed).toBe(true);
    expect(mocks.countMediaOnceWithinTx).toHaveBeenCalledOnce();
    expect(state.balance).toBe(100);
    expect(state.ledgerEntries).toBe(0);
    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it("commits the result and accounting through the same transaction", async () => {
    const response = await POST(videoRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      submissionId: "submission_test",
      balance: 95,
      coaching: { score: 8 },
    });
    expect(state.completed).toBe(true);
    expect(state.failed).toBe(false);
    expect(state.balance).toBe(95);
    expect(state.ledgerEntries).toBe(1);
    expect(mocks.countMediaOnceWithinTx).toHaveBeenCalledWith(
      tx,
      "user_test",
      "user_test/clip.webm",
      128,
      "submission_test",
      1_000_000,
    );
  });
});
