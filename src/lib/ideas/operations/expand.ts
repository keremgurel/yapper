import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import type { VersionFormat } from "@/lib/content/formats";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { expandIdea } from "@/lib/ideas/expand";
import type { IdeaExpansion, IdeaInput } from "@/lib/ideas/types";
import {
  expansionFromVersion,
  materialFromInput,
} from "@/lib/ideas/versions/first-draft";
import { writeVersion } from "@/lib/ideas/versions/write";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

export interface ChargedExpansion {
  expansion: IdeaExpansion;
  balance: number;
  used: Awaited<ReturnType<typeof getBrainContextSafe>>["used"];
}

/**
 * Write an idea's first draft from the creator's words and their Brain, billed
 * as `expand_idea` and refunded when the writing fails. The composer (through
 * /api/ideas/expand) and Chirpy share it. `request` only identifies the
 * caller for the provider spend limit.
 */
export async function chargedIdeaExpansion(
  request: Request,
  userId: string,
  input: IdeaInput,
  format: VersionFormat,
  signal?: AbortSignal,
): Promise<OperationResult<ChargedExpansion>> {
  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");
  const billing = await preflightPaidActionOrResponse(userId, "expand_idea");
  if (billing) return refusedBy(billing);

  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "ideas-expand",
  );
  if (spendLimited) return refusedBy(spendLimited);
  const access = await reservePaidActionOrResponse(userId, "expand_idea");
  if (access.response) return refusedBy(access.response);
  const { reservation } = access;

  // Read server-side rather than trusted from the client, so a request cannot
  // claim someone else's pillars or voice. Loaded after the gates, so a request
  // that will be refused never spends a provider call on routing.
  const brain = await getBrainContextSafe(userId, {
    surface: "expand",
    memoryTask: input.transcript
      ? `Develop this idea: ${input.transcript}`
      : undefined,
    format,
    task: [
      input.source?.title,
      input.transcript,
      input.source?.summary,
      input.source?.transcript?.slice(0, 1500),
    ]
      .filter(Boolean)
      .join("\n"),
    signal,
  });
  const context = { section: brain.section, pillarNames: brain.pillarNames };
  try {
    // Short-form keeps the drafting prompt it always had; a long-form or
    // article lead is written in its own shape.
    const expansion =
      format === "short"
        ? await expandIdea(input, context, signal)
        : expansionFromVersion(
            await writeVersion(
              format,
              materialFromInput(input),
              null,
              context,
              signal,
            ),
          );
    return succeeded({
      expansion,
      balance: reservation.balance,
      used: brain.used,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "expand_failed";
    await refundCreditReservation(userId, reservation, detail);
    return refused(
      detail === "no_provider" ? 501 : 502,
      "expand_failed",
      detail,
    );
  }
}
