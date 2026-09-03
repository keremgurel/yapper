import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canUsePremium: vi.fn(),
  getBalance: vi.fn(),
  deductCredits: vi.fn(),
  grantCredits: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("@/lib/billing/gate", () => ({
  canUsePremium: mocks.canUsePremium,
}));
vi.mock("@/lib/db/credits", async () => {
  class InsufficientCreditsError extends Error {}
  return {
    deductCredits: mocks.deductCredits,
    getBalance: mocks.getBalance,
    grantCredits: mocks.grantCredits,
    InsufficientCreditsError,
  };
});
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));

import {
  BillingAccessError,
  PAID_ACTIONS,
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidAction,
} from "./actions";
import { InsufficientCreditsError } from "@/lib/db/credits";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.getBalance.mockResolvedValue(42);
  mocks.deductCredits.mockResolvedValue(42);
  mocks.grantCredits.mockResolvedValue(43);
});

describe("paid action reservations", () => {
  it("preflights entitlement without attempting a debit", async () => {
    mocks.canUsePremium.mockResolvedValue(false);

    const response = await preflightPaidActionOrResponse(
      "user_1",
      "transcribe",
    );

    expect(response?.status).toBe(402);
    await expect(response?.json()).resolves.toEqual({ error: "not_entitled" });
    expect(mocks.getBalance).not.toHaveBeenCalled();
    expect(mocks.deductCredits).not.toHaveBeenCalled();
  });

  it("preflights the catalog cost without attempting a debit", async () => {
    mocks.getBalance.mockResolvedValue(1);

    const response = await preflightPaidActionOrResponse(
      "user_1",
      "creator_analysis",
    );

    expect(response?.status).toBe(402);
    await expect(response?.json()).resolves.toEqual({
      error: "insufficient_credits",
    });
    expect(mocks.deductCredits).not.toHaveBeenCalled();
  });

  it("passes preflight when entitlement and balance cover the action", async () => {
    await expect(
      preflightPaidActionOrResponse("user_1", "transcribe"),
    ).resolves.toBeNull();
    expect(mocks.ensureUser).toHaveBeenCalledWith("user_1");
    expect(mocks.getBalance).toHaveBeenCalledWith("user_1");
  });

  it("rejects non-members before touching their balance", async () => {
    mocks.canUsePremium.mockResolvedValue(false);

    await expect(reservePaidAction("user_1", "transcribe")).rejects.toEqual(
      new BillingAccessError("not_entitled"),
    );
    expect(mocks.deductCredits).not.toHaveBeenCalled();
  });

  it("atomically reserves the catalog cost before provider work", async () => {
    const reservation = await reservePaidAction("user_1", "creator_analysis");

    expect(mocks.deductCredits).toHaveBeenCalledWith(
      "user_1",
      PAID_ACTIONS.creator_analysis.credits,
      expect.objectContaining({
        metadata: expect.objectContaining({ action: "creator_analysis" }),
      }),
    );
    expect(reservation).toMatchObject({
      action: "creator_analysis",
      cost: 4,
      quantity: 1,
      balance: 42,
    });
  });

  it("multiplies the catalog cost by the quantity and records it", async () => {
    const reservation = await reservePaidAction("user_1", "design_overlay", {
      quantity: 3,
    });

    expect(mocks.deductCredits).toHaveBeenCalledWith(
      "user_1",
      6,
      expect.objectContaining({
        metadata: expect.objectContaining({
          action: "design_overlay",
          quantity: 3,
        }),
      }),
    );
    expect(reservation).toMatchObject({ cost: 6, quantity: 3 });
  });

  it("refuses a quantity outside the batch cap before touching the ledger", async () => {
    await expect(
      reservePaidAction("user_1", "design_overlay", { quantity: 9 }),
    ).rejects.toBeInstanceOf(RangeError);
    await expect(
      reservePaidAction("user_1", "design_overlay", { quantity: 0 }),
    ).rejects.toBeInstanceOf(RangeError);
    expect(mocks.deductCredits).not.toHaveBeenCalled();
  });

  it("preflights the whole batch cost", async () => {
    mocks.getBalance.mockResolvedValue(5);

    const response = await preflightPaidActionOrResponse(
      "user_1",
      "design_overlay",
      { quantity: 3 },
    );

    expect(response?.status).toBe(402);
  });

  it("refunds part of a batch and marks the ledger row partial", async () => {
    await refundCreditReservation(
      "user_1",
      {
        action: "design_overlay",
        cost: 6,
        quantity: 3,
        balance: 36,
        usageId: "usage_2",
      },
      "invalid_scene",
      { amount: 2 },
    );

    expect(mocks.grantCredits).toHaveBeenCalledWith(
      "user_1",
      2,
      "refund",
      expect.objectContaining({
        metadata: expect.objectContaining({ partial: true }),
      }),
    );
  });

  it("never refunds more than was reserved, and nothing for zero", async () => {
    const reservation = {
      action: "design_overlay" as const,
      cost: 6,
      quantity: 3,
      balance: 36,
      usageId: "usage_3",
    };
    await refundCreditReservation("user_1", reservation, "x", { amount: 40 });
    expect(mocks.grantCredits).toHaveBeenLastCalledWith(
      "user_1",
      6,
      "refund",
      expect.anything(),
    );
    mocks.grantCredits.mockClear();
    await refundCreditReservation("user_1", reservation, "x", { amount: 0 });
    expect(mocks.grantCredits).not.toHaveBeenCalled();
  });

  it("returns the billing error when the atomic debit loses a race", async () => {
    mocks.deductCredits.mockRejectedValue(new InsufficientCreditsError());

    await expect(reservePaidAction("user_1", "brainstorm")).rejects.toEqual(
      new BillingAccessError("insufficient_credits"),
    );
  });

  it("returns reserved credits when provider work fails", async () => {
    await refundCreditReservation(
      "user_1",
      {
        action: "transcribe",
        cost: 1,
        quantity: 1,
        balance: 41,
        usageId: "usage_1",
      },
      "provider_500",
    );

    expect(mocks.grantCredits).toHaveBeenCalledWith(
      "user_1",
      1,
      "refund",
      expect.objectContaining({
        metadata: expect.objectContaining({
          action: "transcribe",
          usageId: "usage_1",
          reason: "provider_500",
        }),
      }),
    );
  });
});
