import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardProviderIngress: vi.fn(),
  guardProviderSpend: vi.fn(),
  preflightPaidActionOrResponse: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflightPaidActionOrResponse,
  refundCreditReservation: vi.fn(),
  reservePaidActionOrResponse: vi.fn(),
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.guardProviderIngress.mockResolvedValue(null);
  mocks.guardProviderSpend.mockResolvedValue(null);
  mocks.preflightPaidActionOrResponse.mockResolvedValue(null);
});

describe("POST /api/transcribe rate-limit placement", () => {
  it("does not consume provider spend when no provider is configured", async () => {
    const response = await POST(
      new Request("https://ypr.app/api/transcribe", {
        method: "POST",
        headers: { "content-type": "audio/wav" },
        body: new Uint8Array([1, 2, 3]),
      }),
    );

    expect(response.status).toBe(501);
    expect(mocks.guardProviderIngress).toHaveBeenCalledOnce();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body before billing or provider spend", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    const response = await POST(
      new Request("https://ypr.app/api/transcribe", {
        method: "POST",
        headers: {
          "content-type": "audio/wav",
          "content-length": "4000001",
        },
        body: new Uint8Array([1]),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: "payload_too_large",
      limitBytes: 4_000_000,
    });
    expect(mocks.preflightPaidActionOrResponse).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects a non-audio media type before billing or provider spend", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    const response = await POST(
      new Request("https://ypr.app/api/transcribe", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: new Uint8Array([1]),
      }),
    );

    expect(response.status).toBe(415);
    expect(mocks.preflightPaidActionOrResponse).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "NaN", "Infinity", "601"])(
    "rejects invalid declared audio duration %s before billing",
    async (duration) => {
      vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
      const response = await POST(
        new Request("https://ypr.app/api/transcribe", {
          method: "POST",
          headers: {
            "content-type": "audio/webm; codecs=opus",
            "x-audio-duration": duration,
          },
          body: new Uint8Array([1]),
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "invalid_audio_duration",
      });
      expect(mocks.preflightPaidActionOrResponse).not.toHaveBeenCalled();
      expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid duration without pulling the request body", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>(
      {
        pull() {
          pull();
          return new Promise<void>(() => undefined);
        },
      },
      { highWaterMark: 0 },
    );
    const request = new Request("https://ypr.app/api/transcribe", {
      method: "POST",
      headers: {
        "content-type": "audio/wav",
        "x-audio-duration": "601",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(pull).not.toHaveBeenCalled();
    expect(request.bodyUsed).toBe(false);
    expect(mocks.preflightPaidActionOrResponse).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    await request.body?.cancel();
  });

  it("keeps duration optional for short voice-capture requests", async () => {
    const response = await POST(
      new Request("https://ypr.app/api/transcribe", {
        method: "POST",
        headers: { "content-type": "audio/webm" },
        body: new Uint8Array([1]),
      }),
    );

    expect(response.status).toBe(501);
  });

  it.each([
    "audio/x-wav",
    "audio/x-m4a",
    "video/mp4",
    "video/webm",
    "video/quicktime",
  ])(
    "accepts transcript-recovery attachment media type %s",
    async (contentType) => {
      const response = await POST(
        new Request("https://ypr.app/api/transcribe", {
          method: "POST",
          headers: { "content-type": contentType },
          body: new Uint8Array([1]),
        }),
      );

      // With no provider configured, reaching this response proves the body
      // passed media validation instead of being rejected with 415.
      expect(response.status).toBe(501);
      expect(mocks.preflightPaidActionOrResponse).not.toHaveBeenCalled();
      expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    },
  );
});
