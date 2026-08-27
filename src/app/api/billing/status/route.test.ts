import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getBalance: vi.fn(),
  getBillingState: vi.fn(),
  getStorageBytes: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/billing", () => ({
  getBillingState: mocks.getBillingState,
}));
vi.mock("@/lib/db/credits", () => ({ getBalance: mocks.getBalance }));
vi.mock("@/lib/db/users", () => ({
  getStorageBytes: mocks.getStorageBytes,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.getBalance.mockResolvedValue(88);
  mocks.getStorageBytes.mockResolvedValue(3 * 1024 * 1024 * 1024);
  mocks.getBillingState.mockResolvedValue({
    stripeCustomerId: "cus_test",
    subscriptionStatus: "active",
    plan: "creator_monthly",
    currentPeriodEnd: new Date("2026-09-27T00:00:00.000Z"),
  });
});

describe("GET /api/billing/status", () => {
  it("returns storage usage and the allowance for the current plan", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      entitled: true,
      plan: "creator_monthly",
      balance: 88,
      storageBytes: 3 * 1024 * 1024 * 1024,
      storageQuotaBytes: 50 * 1024 * 1024 * 1024,
    });
  });

  it("does not read account data for a signed-out request", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.getStorageBytes).not.toHaveBeenCalled();
  });
});
