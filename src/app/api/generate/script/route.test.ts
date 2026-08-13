import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  canUsePremium: vi.fn(),
  ensureUser: vi.fn(),
  getBalance: vi.fn(),
  getProjectContextSafe: vi.fn(),
  guardProviderIngress: vi.fn(),
  guardProviderSpend: vi.fn(),
  generateScript: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/billing/gate", () => ({ canUsePremium: mocks.canUsePremium }));
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));
vi.mock("@/lib/db/credits", () => ({
  deductCredits: vi.fn(),
  getBalance: mocks.getBalance,
  InsufficientCreditsError: class extends Error {},
}));
vi.mock("@/lib/content/project-context-server", () => ({
  getProjectContextSafe: mocks.getProjectContextSafe,
}));
vi.mock("@/lib/provider-rate-limit", () => ({
  guardProviderIngress: mocks.guardProviderIngress,
  guardProviderSpend: mocks.guardProviderSpend,
}));
vi.mock("@/lib/generate/script", () => ({
  generateScript: mocks.generateScript,
}));

import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SURPLUS_API_KEY", "surplus_test");
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.getBalance.mockResolvedValue(100);
  mocks.getProjectContextSafe.mockResolvedValue({ block: "context" });
  mocks.guardProviderIngress.mockResolvedValue(null);
  mocks.guardProviderSpend.mockResolvedValue(null);
});

describe("POST /api/generate/script rate-limit placement", () => {
  it("rejects no-input before context loading and provider spend", async () => {
    const response = await POST(
      new Request("https://ypr.app/api/generate/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }) as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "generate_failed",
      detail: "no_input",
    });
    expect(mocks.getProjectContextSafe).not.toHaveBeenCalled();
    expect(mocks.guardProviderSpend).not.toHaveBeenCalled();
    expect(mocks.generateScript).not.toHaveBeenCalled();
  });
});
