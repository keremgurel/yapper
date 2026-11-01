import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  proposeIngest,
  type IngestProposal,
  type IngestSubject,
} from "@/lib/brain/ingest";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

/**
 * Name a parsed paste so it can be filed, billed as `ingest_context` and
 * refunded when the naming fails. Only the sample and a sentence about its
 * shape reach the model, never the import, and nothing is saved here: the
 * Brain page (through /api/brain/ingest) shows the proposal in a preview, and
 * Chirpy files it with an ordinary section create. `request` only identifies
 * the caller for the provider spend limit.
 */
export async function chargedIngestProposal(
  request: Request,
  userId: string,
  subject: IngestSubject,
  signal?: AbortSignal,
): Promise<OperationResult<{ proposal: IngestProposal; balance: number }>> {
  await ensureUser(userId);
  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");
  const billing = await preflightPaidActionOrResponse(userId, "ingest_context");
  if (billing) return refusedBy(billing);

  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "brain-ingest",
  );
  if (spendLimited) return refusedBy(spendLimited);
  const access = await reservePaidActionOrResponse(userId, "ingest_context");
  if (access.response) return refusedBy(access.response);
  const { reservation } = access;

  try {
    const proposal = await proposeIngest(subject, signal);
    return succeeded({ proposal, balance: reservation.balance });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "ingest_failed");
    console.error("[brain/ingest] failed", error);
    return refused(502, "ingest_failed");
  }
}
