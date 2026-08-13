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

  it("caps both completions and gives them one abortable deadline", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: "hello" } }] }),
      )
      .mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: "hello" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ words: [{ text: "hello" }] }));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstInit = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const secondInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(firstInit.body as string)).toMatchObject({
      max_completion_tokens: 8_192,
    });
    expect(JSON.parse(secondInit.body as string)).toMatchObject({
      max_completion_tokens: 8_192,
    });
    expect(firstInit.signal).toBeInstanceOf(AbortSignal);
    expect(secondInit.signal).toBeInstanceOf(AbortSignal);
  });

  it("does not start the critic after the shared deadline and refunds once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ choices: [{ message: { content: "hello" } }] }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(51_001);

    const response = await POST(request({ words: [{ text: "hello" }] }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: "timeout" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(mocks.refund).toHaveBeenCalledOnce();
    expect(mocks.refund).toHaveBeenCalledWith(
      "user_test",
      expect.objectContaining({ usageId: "usage_test" }),
      "timeout",
    );
  });
});
