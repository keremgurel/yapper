import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  guardProviderIngress: vi.fn(),
  guardProviderSpend: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: vi.fn(),
  refundCreditReservation: vi.fn(),
  reservePaidActionOrResponse: vi.fn(),
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
  vi.stubEnv("SURPLUS_API_KEY", "test_key");
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.guardProviderIngress.mockResolvedValue(null);
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
});
