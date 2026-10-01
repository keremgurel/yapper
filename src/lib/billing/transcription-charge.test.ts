import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refund: vi.fn(), deduct: vi.fn() }));
vi.mock("./actions", () => ({ refundCreditReservation: mocks.refund }));
vi.mock("@/lib/db/credits", () => ({ deductCredits: mocks.deduct }));
import { settleTranscriptionCharge } from "./transcription-charge";
import type { CreditReservation } from "./actions";
const reservation: CreditReservation = {
  action: "transcribe",
  quantity: 1,
  cost: 2,
  balance: 18,
  usageId: "usage",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.deduct.mockResolvedValue(16);
});
describe("transcription settlement", () => {
  it("charges only the difference for a longer decoded recording", async () => {
    expect(await settleTranscriptionCharge("user", reservation, 90)).toEqual({
      balance: 16,
      creditsUsed: 4,
    });
    expect(mocks.deduct).toHaveBeenCalledWith(
      "user",
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          sourceSeconds: 90,
          usageId: "usage",
        }),
      }),
    );
  });
  it("refunds over-reservation when the decoded source is shorter", async () => {
    expect(
      await settleTranscriptionCharge(
        "user",
        { ...reservation, quantity: 3, cost: 6, balance: 14 },
        60,
      ),
    ).toEqual({ balance: 18, creditsUsed: 2 });
    expect(mocks.refund).toHaveBeenCalledWith(
      "user",
      expect.anything(),
      "shorter_than_reserved",
      { amount: 4 },
    );
  });
  it("does not debit the base amount again", async () => {
    expect(await settleTranscriptionCharge("user", reservation, 30)).toEqual({
      balance: 18,
      creditsUsed: 2,
    });
    expect(mocks.deduct).not.toHaveBeenCalled();
    expect(mocks.refund).not.toHaveBeenCalled();
  });
  it("propagates insufficient funds so the route can reject and refund the reservation", async () => {
    mocks.deduct.mockRejectedValue(new Error("insufficient_credits"));
    await expect(
      settleTranscriptionCharge("user", reservation, 90),
    ).rejects.toThrow("insufficient_credits");
  });
});
