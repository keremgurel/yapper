import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { TemporaryFileTooLargeError } from "@/lib/http/bounded-temp-file";

const mocks = vi.hoisted(() => {
  class InsufficientCreditsError extends Error {}
  class StorageQuotaError extends Error {}

  return {
    InsufficientCreditsError,
    StorageQuotaError,
    auth: vi.fn(),
    canUsePremium: vi.fn(),
    activateObjectWithinTx: vi.fn(),
    coachOnCamera: vi.fn(),
    countMediaOnceWithinTx: vi.fn(),
    deleteObject: vi.fn(),
    deductWithinTx: vi.fn(),
    ensureUser: vi.fn(),
    getBalance: vi.fn(),
    getObjectFile: vi.fn(),
    getStorageBytes: vi.fn(),
    getStorageQuota: vi.fn(),
    guardProviderSpend: vi.fn(),
    guardProviderIngress: vi.fn(),
    ownsKey: vi.fn(),
    protectPendingObject: vi.fn(),
    uploadFileToGemini: vi.fn(),
  };
});

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
  activateObjectWithinTx: mocks.activateObjectWithinTx,
  protectPendingObject: mocks.protectPendingObject,
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
  uploadFileToGemini: mocks.uploadFileToGemini,
}));
vi.mock("@/lib/feedback/video", () => ({
  coachOnCamera: mocks.coachOnCamera,
}));
vi.mock("@/lib/r2", () => ({
  deleteObject: mocks.deleteObject,
  getObjectFile: mocks.getObjectFile,
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

function videoRequest(signal?: AbortSignal): NextRequest {
  return new Request(
    "https://ypr.app/api/feedback?tier=video&mediaKey=user_test/clip.webm",
    { method: "POST", signal },
  ) as NextRequest;
}

function videoRequestWith(query: string): NextRequest {
  return new Request(`https://ypr.app/api/feedback?tier=video&${query}`, {
    method: "POST",
  }) as NextRequest;
}

function audioRequest(
  headers: HeadersInit,
  body: BodyInit = new Uint8Array([1]),
): NextRequest {
  return new Request("https://ypr.app/api/feedback?tier=audio", {
    method: "POST",
    headers,
    body,
  }) as NextRequest;
}

beforeEach(() => {
  vi.stubEnv("SURPLUS_API_KEY", "surplus_test");
  vi.stubEnv("GEMINI_API_KEY", "gemini_test");
  vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
  state.balance = 100;
  state.completed = false;
  state.failed = false;
  state.ledgerEntries = 0;
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.getBalance.mockResolvedValue(100);
  mocks.ownsKey.mockReturnValue(true);
  mocks.getObjectFile.mockResolvedValue({
    filePath: "/tmp/feedback-video.webm",
    byteLength: 128,
    contentType: "video/webm",
    cleanup: vi.fn().mockResolvedValue(undefined),
  });
  mocks.getStorageBytes.mockResolvedValue(0);
  mocks.getStorageQuota.mockResolvedValue(1_000_000);
  mocks.uploadFileToGemini.mockResolvedValue("gemini://clip");
  mocks.coachOnCamera.mockResolvedValue({ score: 8 });
  mocks.deductWithinTx.mockImplementation(async () => {
    state.balance -= 5;
    state.ledgerEntries += 1;
    return state.balance;
  });
  mocks.countMediaOnceWithinTx.mockResolvedValue(undefined);
  mocks.activateObjectWithinTx.mockResolvedValue(undefined);
  mocks.guardProviderSpend.mockResolvedValue(null);
  mocks.guardProviderIngress.mockResolvedValue(null);
  mocks.protectPendingObject.mockResolvedValue(true);

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
  vi.restoreAllMocks();
});

describe("POST /api/feedback atomic completion", () => {
  it("rejects oversized audio before billing or provider spend", async () => {
    const response = await POST(
      audioRequest({
        "content-type": "audio/wav",
        "content-length": "4000001",
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "payload_too_large",
      limitBytes: 4_000_000,
    });
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("requires canonical WAV for feedback audio before billing", async () => {
    const response = await POST(audioRequest({ "content-type": "audio/webm" }));

    expect(response.status).toBe(415);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("does not read or require a body for video-only feedback", async () => {
    const response = await POST(videoRequest());

    expect(response.status).toBe(200);
    expect(mocks.guardProviderSpend).toHaveBeenCalledOnce();
  });

  it("captures the workflow deadline before auth and preflight work", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValue(101_000);

    const response = await POST(videoRequest());

    expect(response.status).toBe(200);
    const workflow = mocks.uploadFileToGemini.mock.calls[0][3] as {
      deadlineAt: number;
    };
    expect(workflow.deadlineAt).toBe(271_000);
  });

  it("does not create a submission when preflight exhausts the route budget", async () => {
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValue(271_000);

    const response = await POST(videoRequest());

    expect(response.status).toBe(504);
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.getObjectFile).not.toHaveBeenCalled();
  });

  it("rejects an overlong media key before database or provider work", async () => {
    const response = await POST(
      videoRequestWith(`mediaKey=${"a".repeat(513)}`),
    );

    expect(response.status).toBe(400);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.getObjectFile).not.toHaveBeenCalled();
  });

  it("rejects an unsupported video MIME before database or provider work", async () => {
    const response = await POST(
      videoRequestWith("mediaKey=user_test%2Fclip.bin&mimeType=text%2Fplain"),
    );

    expect(response.status).toBe(415);
    expect(mocks.ensureUser).not.toHaveBeenCalled();
    expect(mocks.getObjectFile).not.toHaveBeenCalled();
  });

  it("accepts a supported video MIME with codec parameters", async () => {
    const response = await POST(
      videoRequestWith(
        "mediaKey=user_test%2Fclip.webm&mimeType=video%2Fwebm%3Bcodecs%3Dvp9%2Copus",
      ),
    );

    expect(response.status).toBe(200);
    expect(mocks.uploadFileToGemini.mock.calls[0][2]).toBe("video/webm");
  });

  it("does not consume provider spend for a non-entitled user", async () => {
    mocks.canUsePremium.mockResolvedValue(false);

    const response = await POST(videoRequest());

    expect(response.status).toBe(402);
    expect(mocks.guardProviderIngress).toHaveBeenCalledOnce();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    expect(mocks.coachOnCamera).not.toHaveBeenCalled();
  });

  it("does not consume provider spend when required providers are absent", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const response = await POST(videoRequest());

    expect(response.status).toBe(501);
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    expect(mocks.coachOnCamera).not.toHaveBeenCalled();
  });

  it("allows video feedback without Surplus when Gemini is configured", async () => {
    vi.stubEnv("SURPLUS_API_KEY", "");

    const response = await POST(videoRequest());

    expect(response.status).toBe(200);
    expect(mocks.guardProviderSpend).toHaveBeenCalledOnce();
  });

  it("rejects unavailable media before creating a processing submission", async () => {
    mocks.protectPendingObject.mockResolvedValue(false);

    const response = await POST(videoRequest());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "media_unavailable",
    });
    expect(db.insert).not.toHaveBeenCalled();
    expect(mocks.coachOnCamera).not.toHaveBeenCalled();
  });

  it("preserves caller-owned media when provider processing fails", async () => {
    mocks.coachOnCamera.mockRejectedValue(new Error("provider_down"));

    const response = await POST(videoRequest());

    expect(response.status).toBe(502);
    expect(state.failed).toBe(true);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
    expect(mocks.deleteObject).not.toHaveBeenCalled();
    const file = await mocks.getObjectFile.mock.results[0]?.value;
    expect(file.cleanup).toHaveBeenCalledOnce();
  });

  it("rejects an oversized R2 object by actual streamed bytes without charging", async () => {
    mocks.getObjectFile.mockRejectedValueOnce(
      new TemporaryFileTooLargeError(250 * 1024 * 1024),
    );

    const response = await POST(videoRequest());

    expect(response.status).toBe(413);
    expect(mocks.uploadFileToGemini).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
    expect(state.failed).toBe(true);
  });

  it("treats caller abort as terminal and never charges", async () => {
    const controller = new AbortController();
    mocks.getObjectFile.mockImplementationOnce(async () => {
      controller.abort(new DOMException("gone", "AbortError"));
      throw new Error("r2_aborted");
    });

    const response = await POST(videoRequest(controller.signal));

    expect(response.status).toBe(499);
    expect(mocks.uploadFileToGemini).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
    expect(state.failed).toBe(true);
  });

  it("rechecks cancellation after the provider resolves and before charging", async () => {
    const controller = new AbortController();
    mocks.coachOnCamera.mockImplementationOnce(async () => {
      controller.abort(new DOMException("gone", "AbortError"));
      return { score: 8 };
    });

    const response = await POST(videoRequest(controller.signal));

    expect(response.status).toBe(499);
    expect(db.transaction).not.toHaveBeenCalled();
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
    expect(state.failed).toBe(true);
  });

  it("cleans the bounded temporary file after successful processing", async () => {
    const response = await POST(videoRequest());
    const downloaded = await mocks.getObjectFile.mock.results[0]?.value;

    expect(response.status).toBe(200);
    expect(downloaded.cleanup).toHaveBeenCalledOnce();
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

  it("rolls completion back when lifecycle activation fails", async () => {
    mocks.activateObjectWithinTx.mockRejectedValue(
      new Error("r2_object_not_attachable"),
    );

    const response = await POST(videoRequest());

    expect(response.status).toBe(502);
    expect(state.completed).toBe(false);
    expect(state.failed).toBe(true);
    expect(state.balance).toBe(100);
    expect(mocks.countMediaOnceWithinTx).not.toHaveBeenCalled();
    expect(mocks.deductWithinTx).not.toHaveBeenCalled();
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
