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
              content: '{"clusters":[{"keep":[2,2],"drop":[[1,1]]}]}',
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
      max_completion_tokens: 32_000,
      temperature: 0,
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
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

  it("refuses a truncated answer rather than applying half of it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        choices: [
          { finish_reason: "length", message: { content: '{"clusters":[' } },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words: [{ text: "hello" }] }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "transcript_too_long",
    });
    expect(mocks.refund).toHaveBeenCalledOnce();
  });
});
