import {
  refundCreditReservation,
  type CreditReservation,
} from "@/lib/billing/actions";
import { deductCredits, InsufficientCreditsError } from "@/lib/db/credits";

/**
 * Brings what was reserved in line with what the transcriber actually heard.
 *
 * Over-reserved units go back. Under-reserved ones (a length the platform did
 * not report) are taken now; if the balance cannot cover them the sample is
 * kept anyway, since the provider has already been paid, and the shortfall is
 * logged rather than charged twice later.
 */
export async function settleSampleCredits(
  userId: string,
  reservation: CreditReservation | null,
  actualUnits: number,
): Promise<number> {
  if (!reservation) return 0;
  if (actualUnits < reservation.quantity) {
    const over = reservation.quantity - actualUnits;
    await refundCreditReservation(
      userId,
      reservation,
      "shorter_than_reserved",
      {
        amount: over,
      },
    );
    return actualUnits;
  }
  if (actualUnits > reservation.quantity) {
    const extra = actualUnits - reservation.quantity;
    try {
      await deductCredits(userId, extra, {
        metadata: {
          action: reservation.action,
          usageId: reservation.usageId,
          quantity: extra,
          settlement: true,
        },
      });
      return actualUnits;
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        console.warn("[voice] settlement short", {
          userId,
          usageId: reservation.usageId,
          extra,
        });
        return reservation.quantity;
      }
      throw error;
    }
  }
  return actualUnits;
}
