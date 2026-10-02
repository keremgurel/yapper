import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getBalance: vi.fn(),
  getBillingState: vi.fn(),
  getStorageBytes: vi.fn(),
  getTrainSpendable: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/billing", () => ({
  getBillingState: mocks.getBillingState,
}));
vi.mock("@/lib/db/credits", () => ({ getBalance: mocks.getBalance }));
vi.mock("@/lib/db/users", () => ({
  getStorageBytes: mocks.getStorageBytes,
}));
vi.mock("@/lib/db/train-wallet", () => ({
  getTrainSpendable: mocks.getTrainSpendable,
}));

import { GET } from "./route";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-20T00:00:00.000Z"));
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "user_test" });
  mocks.getBalance.mockResolvedValue(88);
  mocks.getStorageBytes.mockResolvedValue(3 * 1024 * 1024 * 1024);
  mocks.getTrainSpendable.mockResolvedValue(3);
  mocks.getBillingState.mockImplementation(async (_id, product = "studio") =>
    product === "train"
      ? null
      : {
          stripeCustomerId: "cus_test",
          subscriptionStatus: "active",
          plan: "creator_monthly",
          currentPeriodEnd: new Date("2026-09-27T00:00:00.000Z"),
        },
  );
});

afterEach(() => {
  vi.useRealTimers();
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
      storageQuotaBytes: 5 * 1024 * 1024 * 1024,
    });
  });

  it("does not read account data for a signed-out request", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.getStorageBytes).not.toHaveBeenCalled();
  });

  it("removes entitlement and storage allowance after the paid period and grace expire", async () => {
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));

    const response = await GET();

    await expect(response.json()).resolves.toMatchObject({
      entitled: false,
      storageQuotaBytes: 0,
      balance: 88,
    });
  });

  it("reports Train separately from Studio", async () => {
    const withoutPlan = await (await GET()).json();
    expect(withoutPlan.train).toMatchObject({
      entitled: false,
      plan: null,
      balance: 3,
      unlimited: false,
    });

    mocks.getBillingState.mockImplementation(async (_id, product = "studio") =>
      product === "train"
        ? {
            stripeCustomerId: "cus_test",
            subscriptionStatus: "active",
            plan: "train_plus_monthly",
            currentPeriodEnd: new Date("2026-10-20T00:00:00.000Z"),
          }
        : null,
    );
    const withPlan = await (await GET()).json();
    expect(withPlan.entitled).toBe(false);
    expect(withPlan.train).toMatchObject({
      entitled: true,
      plan: "train_plus_monthly",
      unlimited: true,
    });
  });
});
