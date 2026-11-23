import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardProviderIngress: vi.fn(),
  guardProviderSpend: vi.fn(),
  preflight: vi.fn(),
  reserve: vi.fn(),
  refund: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflight,
  refundCreditReservation: mocks.refund,
  reservePaidActionOrResponse: mocks.reserve,
}));

import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://ypr.app/api/clean-transcript", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.stubEnv("SURPLUS_API_KEY", "test_key");
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.guardProviderIngress.mockResolvedValue(null);
  mocks.guardProviderSpend.mockResolvedValue(null);
  mocks.preflight.mockResolvedValue(null);
  mocks.reserve.mockResolvedValue({
    reservation: {
      action: "clean_transcript",
      cost: 1,
      balance: 9,
      usageId: "usage_test",
    },
  });
});

describe("POST /api/clean-transcript payload limits", () => {
  it("preserves the empty-transcript no-op", async () => {
    const response = await POST(request({ words: [] }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ cuts: [] });
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects malformed transcript words before provider spend", async () => {
    const response = await POST(request({ words: [{ text: "x".repeat(81) }] }));
    expect(response.status).toBe(400);
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects a non-object JSON root without throwing", async () => {
    const response = await POST(request(null));
    expect(response.status).toBe(400);
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects a body over 256 KiB", async () => {
    const response = await POST(
      request({ words: [], padding: "x".repeat(256 * 1024) }),
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: "payload_too_large",
    });
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("asks once, with a bounded budget and an abortable signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          {
            message: {
              content: '{"keep":[[0,0],[2,2]]}',
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ words: [{ text: "a" }, { text: "b" }, { text: "c" }] }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ cuts: [[1, 1]] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: "gemini-3.7-flash",
      max_completion_tokens: 8_000,
      temperature: 0,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("offers no tools and constrains the answer to this transcript's spans", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"keep":[[0,2]]}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await POST(
      request({ words: [{ text: "a" }, { text: "b" }, { text: "c" }] }),
    );

    const sent = JSON.parse(
      (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string,
    );
    expect(sent.tools).toBeUndefined();
    expect(sent.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
    // The last word of a three word take is index 2.
    expect(JSON.stringify(sent.response_format)).toContain('"maximum":2');
  });

  it("refuses an edit it cannot read, and refunds the credit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: "sure, here is the edit!" } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words: [{ text: "hello" }] }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "unreadable_edit",
    });
    expect(mocks.refund).toHaveBeenCalledWith(
      "user_test",
      expect.objectContaining({ usageId: "usage_test" }),
      "unreadable_edit",
    );
  });
});

describe("POST /api/clean-transcript when the answer is cut off", () => {
  const words = [{ text: "a" }, { text: "b" }, { text: "c" }];
  // Readable on its own, which is the danger: applied, it would be an edit.
  const cutOff = {
    choices: [
      { finish_reason: "length", message: { content: '{"keep":[[0,0]]}' } },
    ],
  };
  const answered = {
    choices: [{ message: { content: '{"keep":[[0,0],[2,2]]}' } }],
  };
  const budgets = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(
      (call) =>
        JSON.parse((call[1] as RequestInit).body as string)
          .max_completion_tokens,
    );

  it("gives a long take more room than a short one", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: '{"keep":[[0,2891]]}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ words: Array.from({ length: 2_892 }, () => ({ text: "w" })) }),
    );

    expect(response.status).toBe(200);
    expect(budgets(fetchMock)).toEqual([16_000]);
  });

  it("asks again with more room instead of failing the edit", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => Response.json(cutOff))
      .mockImplementationOnce(async () => Response.json(answered));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ cuts: [[1, 1]] });
    expect(budgets(fetchMock)).toEqual([8_000, 12_000]);
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("never applies a cut-off answer, however often it is cut off", async () => {
    const fetchMock = vi.fn(async () => Response.json(cutOff));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "transcript_too_long",
    });
    expect(budgets(fetchMock)).toEqual([8_000, 12_000, 18_000]);
    expect(mocks.refund).toHaveBeenCalledOnce();
  });

  it("stops asking when there is no more room to give", async () => {
    const fetchMock = vi.fn(async () => Response.json(cutOff));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      request({ words: Array.from({ length: 5_000 }, () => ({ text: "w" })) }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "transcript_too_long",
    });
    expect(budgets(fetchMock)).toEqual([28_000, 32_000]);
    expect(mocks.refund).toHaveBeenCalledOnce();
  });

  it("does not start a second try it has no time to finish", async () => {
    let now = 1_000_000;
    const clock = vi.spyOn(Date, "now").mockImplementation(() => now);
    // The first try uses 200 of the 280 seconds, then comes back cut off.
    const fetchMock = vi.fn(async () => {
      now += 200_000;
      return Response.json(cutOff);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));
    clock.mockRestore();

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "transcript_too_long",
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.refund).toHaveBeenCalledOnce();
  });
});

describe("POST /api/clean-transcript when the model does not answer", () => {
  const overloaded = {
    // Seen in production: the gateway answers 200 and carries the provider's
    // failure in the body, with empty content and finish_reason "error".
    error: { code: 503, message: "provider_overloaded" },
    choices: [{ finish_reason: "error", message: { content: "" } }],
  };
  const answered = {
    choices: [{ message: { content: '{"keep":[[0,0],[2,2]]}' } }],
  };
  const words = [{ text: "a" }, { text: "b" }, { text: "c" }];

  it("never reports an empty answer as an edit with no cuts", async () => {
    // A fresh Response per call: a body can only be read once.
    const fetchMock = vi.fn(async () => Response.json(overloaded));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));

    // A 200 with no cuts is what made the editor fall back to guessing the
    // edit locally and present it as the model's.
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "ai_503" });
    expect(mocks.refund).toHaveBeenCalled();
  });

  it("asks a busy model again rather than giving up", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => Response.json(overloaded))
      .mockImplementationOnce(async () => Response.json(answered));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ cuts: [[1, 1]] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("recovers when a marketplace seller returns an HTML gateway page", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(
        async () =>
          new Response("<html><h1>Bad gateway</h1></html>", {
            status: 502,
            headers: { "content-type": "text/html" },
          }),
      )
      .mockImplementationOnce(async () => Response.json(answered));
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ cuts: [[1, 1]] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it("keeps a genuine no-retakes answer as no cuts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [{ message: { content: '{"keep":[[0,2]]}' } }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ cuts: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("complete repeated take boundaries", () => {
  const words =
    "Now it's just maintenance work and adding new Now it's just maintenance work and adding new questions"
      .split(" ")
      .map((text, index) => ({
        text,
        start: index * 0.2,
        end: (index + 1) * 0.2,
      }));
  const answer = (first: number) =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({ keep: [[first, words.length - 1]] }),
          },
        },
      ],
    });
  it("asks for a corrected complete take under the original reservation", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => answer(9))
      .mockImplementationOnce(async () => answer(8));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ words }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ cuts: [[0, 7]] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      JSON.parse(fetchMock.mock.calls[1]![1].body).messages.at(-1).content,
    ).toContain("source word indices: 8");
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("refuses and refunds when the model keeps clipping the same onset", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => answer(9));
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request({ words }));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: "unsafe_take_boundary",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(mocks.refund).toHaveBeenCalledOnce();
  });
});
