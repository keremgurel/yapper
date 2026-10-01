import { PAID_ACTIONS, transcriptionUnits } from "./credit-costs";
import { refundCreditReservation, type CreditReservation } from "./actions";
import { deductCredits } from "@/lib/db/credits";

/** Settle once using decoded source duration, excluding transport overlaps and
 * provider retries. A shortfall rejects delivery rather than giving away work. */
export async function settleTranscriptionCharge(
  userId: string,
  reservation: CreditReservation,
  seconds: number,
) {
  const cost = transcriptionUnits(seconds) * PAID_ACTIONS.transcribe.credits;
  const delta = cost - reservation.cost;
  if (delta > 0) {
    const balance = await deductCredits(userId, delta, {
      metadata: {
        action: "transcribe",
        usageId: reservation.usageId,
        sourceSeconds: seconds,
        settlement: true,
      },
    });
    return { balance, creditsUsed: cost };
  }
  if (delta < 0)
    await refundCreditReservation(
      userId,
      reservation,
      "shorter_than_reserved",
      { amount: -delta },
    );
  return { balance: reservation.balance - delta, creditsUsed: cost };
}
