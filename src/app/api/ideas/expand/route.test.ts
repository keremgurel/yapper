import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getProjectContextSafe: vi.fn(),
  guardProviderIngress: vi.fn(),
  guardProviderSpend: vi.fn(),
  expandIdea: vi.fn(),
  preflight: vi.fn(),
  reserve: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/content/project-context-server", () => ({
  getProjectContextSafe: mocks.getProjectContextSafe,
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/billing/actions", () => ({
  preflightPaidActionOrResponse: mocks.preflight,
  refundCreditReservation: vi.fn(),
  reservePaidActionOrResponse: mocks.reserve,
}));
vi.mock("@/lib/ideas/expand", () => ({ expandIdea: mocks.expandIdea }));

import { POST } from "./route";

const request = (body: unknown) =>
  new Request("https://ypr.app/api/ideas/expand", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SURPLUS_API_KEY", "test_key");
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.guardProviderIngress.mockResolvedValue(null);
  mocks.preflight.mockResolvedValue(null);
  mocks.reserve.mockResolvedValue({
    reservation: {
      action: "expand_idea",
      cost: 2,
      balance: 8,
      usageId: "usage_test",
    },
  });
});

describe("POST /api/ideas/expand payload limits", () => {
  it("rejects malformed optional input without throwing or spending", async () => {
    const response = await POST(request({ input: { transcript: {} } }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "no_input" });
    expect(mocks.getProjectContextSafe).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects a non-object JSON root without throwing", async () => {
    const response = await POST(request(null));
    expect(response.status).toBe(400);
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects a prompt over the aggregate character budget", async () => {
    const response = await POST(
      request({
        input: {
          transcript: "x".repeat(8_000),
          source: {
            url: "https://x.test",
            transcript: "x".repeat(30_000),
            summary: "x".repeat(4_000),
          },
        },
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("rejects a body over 256 KiB", async () => {
    const response = await POST(
      request({
        input: { url: "https://x.test" },
        padding: "x".repeat(256 * 1024),
      }),
    );
    expect(response.status).toBe(413);
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
  });

  it("passes the request abort signal into expansion provider work", async () => {
    mocks.getProjectContextSafe.mockResolvedValue({
      block: "",
      pillarNames: [],
    });
    mocks.guardProviderSpend.mockResolvedValue(null);
    mocks.expandIdea.mockResolvedValue({ title: "Idea", pillar: null });
    const response = await POST(
      request({ input: { transcript: "A bounded idea" } }),
    );

    expect(response.status).toBe(200);
    expect(mocks.expandIdea).toHaveBeenCalledWith(
      expect.objectContaining({ transcript: "A bounded idea" }),
      expect.objectContaining({ block: "" }),
      expect.any(AbortSignal),
    );
  });
});
