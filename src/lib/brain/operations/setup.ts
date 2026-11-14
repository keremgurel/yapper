import { surplusKey } from "@/lib/providers/surplus-key";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import {
  proposeBrainSetup,
  SETUP_ESSENTIAL_KEYS,
  type BrainSetupInput,
  type BrainSetupProposal,
} from "@/lib/brain/setup";
import { listPillars } from "@/lib/db/project-pillars";
import { getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

/**
 * Read one document and propose the whole Brain from it, against what the
 * Essentials and pillars say now. Billed as `brain_setup` and refunded when
 * the reading fails. Nothing is saved here: the setup sheet (through
 * /api/brain/setup) lets the creator edit the proposal field by field, and
 * Chirpy applies it with the ordinary project patch and section creates.
 */
export async function chargedSetupProposal(
  request: Request,
  userId: string,
  document: string,
  signal?: AbortSignal,
): Promise<OperationResult<{ proposal: BrainSetupProposal; balance: number }>> {
  await ensureUser(userId);
  if (!surplusKey("brain")) return refused(501, "no_provider");
  const billing = await preflightPaidActionOrResponse(userId, "brain_setup");
  if (billing) return refusedBy(billing);

  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "brain-ingest",
  );
  if (spendLimited) return refusedBy(spendLimited);
  const access = await reservePaidActionOrResponse(userId, "brain_setup");
  if (access.response) return refusedBy(access.response);
  const { reservation } = access;

  try {
    const project = await getActiveProject(userId);
    const pillars = await listPillars(project.id);
    const current: BrainSetupInput["current"] = {
      essentials: Object.fromEntries(
        SETUP_ESSENTIAL_KEYS.map((key) => [
          key,
          String((project as Record<string, unknown>)[key] ?? "").slice(0, 700),
        ]).filter(([, value]) => value),
      ),
      pillars: pillars.map((pillar) => ({
        name: pillar.name,
        description: pillar.description.slice(0, 300),
      })),
    };
    const proposal = await proposeBrainSetup({ document, current }, signal);
    return succeeded({ proposal, balance: reservation.balance });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "setup_failed");
    console.error("[brain/setup] failed", error);
    return refused(502, "setup_failed");
  }
}
