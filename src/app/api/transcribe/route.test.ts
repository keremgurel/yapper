import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardProviderIngress: vi.fn(),
  guardProviderSpend: vi.fn(),
  preflightPaidActionOrResponse: vi.fn(),
  reservePaidActionOrResponse: vi.fn(),
  refundCreditReservation: vi.fn(),
  fetchBoundedJson: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflightPaidActionOrResponse,
  refundCreditReservation: mocks.refundCreditReservation,
  reservePaidActionOrResponse: mocks.reservePaidActionOrResponse,
}));
vi.mock("@/lib/http/outbound", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/outbound")>();
  return { ...actual, fetchBoundedJson: mocks.fetchBoundedJson };
});

const r2 = vi.hoisted(() => ({
  presignView: vi.fn(),
  discardTranscriptionAudio: vi.fn(),
  getObjectBytes: vi.fn(),
}));

vi.mock("@/lib/r2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/r2")>();
  return {
    ...actual,
    presignView: r2.presignView,
    discardTranscriptionAudio: r2.discardTranscriptionAudio,
    getObjectBytes: r2.getObjectBytes,
  };
});

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.guardProviderIngress.mockResolvedValue(null);
  mocks.guardProviderSpend.mockResolvedValue(null);
  mocks.preflightPaidActionOrResponse.mockResolvedValue(null);
  mocks.reservePaidActionOrResponse.mockResolvedValue({
    reservation: { balance: 4, reservationId: "reservation_test" },
  });
});

describe("POST /api/transcribe provider deadline", () => {
  const request = (signal?: AbortSignal) =>
    new Request("https://ypr.app/api/transcribe", {
      method: "POST",
      headers: {
        "content-type": "audio/wav",
        "x-audio-duration": "1",
      },
      body: new Uint8Array([1, 2, 3]),
      signal,
    });

  it("uses the bounded reader with the inbound signal", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    mocks.fetchBoundedJson.mockResolvedValue({
      response: new Response(null, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      data: {
        metadata: { duration: 1 },
        results: { channels: [{ alternatives: [{ words: [] }] }] },
      },
    });
    const req = request();

    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(mocks.fetchBoundedJson).toHaveBeenCalledOnce();
    expect(mocks.fetchBoundedJson.mock.calls[0]?.[2]).toMatchObject({
      maxBytes: 4_000_000,
      signal: req.signal,
    });
    expect(
      mocks.fetchBoundedJson.mock.calls[0]?.[2]?.timeoutMs,
    ).toBeLessThanOrEqual(108_000);
  });

  it("does not start fallback after a provider timeout and refunds", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    vi.stubEnv("GROQ_API_KEY", "groq_test");
    const { OutboundHttpError } = await import("@/lib/http/outbound");
    mocks.fetchBoundedJson.mockRejectedValue(new OutboundHttpError("timeout"));

    const response = await POST(request());

    expect(response.status).toBe(504);
    expect(mocks.fetchBoundedJson).toHaveBeenCalledOnce();
    expect(mocks.refundCreditReservation).toHaveBeenCalledOnce();
  });

  it("charges pre-provider work against the shared deadline", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    let now = 1_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    mocks.preflightPaidActionOrResponse.mockImplementation(async () => {
      now += 8_000;
      return null;
    });
    mocks.fetchBoundedJson.mockResolvedValue({
      response: new Response(null, {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      data: { metadata: { duration: 1 } },
    });

    await POST(request());

    expect(mocks.fetchBoundedJson.mock.calls[0]?.[2]?.timeoutMs).toBe(100_000);
  });

  it("rejects a result that resolves as the caller aborts", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    vi.stubEnv("GROQ_API_KEY", "groq_test");
    const controller = new AbortController();
    mocks.fetchBoundedJson.mockImplementation(async () => {
      controller.abort("left");
      return {
        response: new Response(null, {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
        data: { metadata: { duration: 1 } },
      };
    });

    const response = await POST(request(controller.signal));

    expect(response.status).toBe(499);
    expect(mocks.fetchBoundedJson).toHaveBeenCalledOnce();
    expect(mocks.refundCreditReservation).toHaveBeenCalledOnce();
  });

  it("bounds and refunds malformed or oversized provider responses", async () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "deepgram_test");
    const { OutboundHttpError } = await import("@/lib/http/outbound");
    mocks.fetchBoundedJson.mockRejectedValue(
      new OutboundHttpError("response_too_large", { limitBytes: 4_000_000 }),
    );

    const response = await POST(request());

    expect(response.status).toBe(502);
    expect(mocks.refundCreditReservation).toHaveBeenCalledOnce();
  });
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

describe("POST /api/transcribe with audio already in storage", () => {
  beforeEach(() => {
    vi.stubEnv("DEEPGRAM_API_KEY", "dg_test");
    vi.stubEnv("R2_ENDPOINT", "https://r2.test");
    vi.stubEnv("R2_ACCESS_KEY_ID", "id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret");
    r2.presignView.mockResolvedValue("https://r2.test/signed-get");
    r2.discardTranscriptionAudio.mockResolvedValue(undefined);
  });

  const stored = (key: string) =>
    new Request("https://ypr.app/api/transcribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });

  const transcript = {
    metadata: { duration: 12 },
    results: {
      channels: [
        {
          alternatives: [
            {
              words: [
                { word: "hello", punctuated_word: "Hello", start: 0, end: 0.4 },
              ],
            },
          ],
        },
      ],
    },
  };

  it("hands the transcriber a link and never the audio", async () => {
    mocks.fetchBoundedJson.mockResolvedValue({
      response: { ok: true },
      data: transcript,
    });

    const response = await POST(stored("u/user_test/asr/abc.m4a"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      words: [{ text: "Hello", start: 0, end: 0.4 }],
    });
    const [, init] = mocks.fetchBoundedJson.mock.calls[0];
    // A few hundred bytes, whatever the take's length.
    expect(JSON.parse(init.body as string)).toEqual({
      url: "https://r2.test/signed-get",
    });
    expect(r2.discardTranscriptionAudio).toHaveBeenCalledWith(
      "u/user_test/asr/abc.m4a",
    );
  });

  it("refuses a key belonging to somebody else", async () => {
    const response = await POST(stored("u/someone_else/asr/abc.m4a"));

    expect(response.status).toBe(400);
    expect(mocks.fetchBoundedJson).not.toHaveBeenCalled();
    expect(mocks.reservePaidActionOrResponse).not.toHaveBeenCalled();
    expect(r2.discardTranscriptionAudio).not.toHaveBeenCalled();
  });

  it("refuses a key outside the scratch prefix", async () => {
    const response = await POST(stored("u/user_test/recording.m4a"));

    expect(response.status).toBe(400);
    expect(mocks.fetchBoundedJson).not.toHaveBeenCalled();
  });

  it("throws the audio away even when the transcriber fails", async () => {
    mocks.fetchBoundedJson.mockResolvedValue({
      response: { ok: false, status: 500 },
      data: {},
    });

    const response = await POST(stored("u/user_test/asr/abc.m4a"));

    expect(response.status).toBe(502);
    expect(r2.discardTranscriptionAudio).toHaveBeenCalledWith(
      "u/user_test/asr/abc.m4a",
    );
    expect(mocks.refundCreditReservation).toHaveBeenCalled();
  });
});
