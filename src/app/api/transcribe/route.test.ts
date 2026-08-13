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
});
