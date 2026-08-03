import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canUsePremium: vi.fn(),
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
    grantCredits: mocks.grantCredits,
    InsufficientCreditsError,
  };
});
vi.mock("@/lib/db/users", () => ({ ensureUser: mocks.ensureUser }));

import {
  BillingAccessError,
  PAID_ACTIONS,
  refundCreditReservation,
  reservePaidAction,
} from "./actions";
import { InsufficientCreditsError } from "@/lib/db/credits";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.canUsePremium.mockResolvedValue(true);
  mocks.deductCredits.mockResolvedValue(42);
  mocks.grantCredits.mockResolvedValue(43);
});

describe("paid action reservations", () => {
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
      balance: 42,
    });
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
