import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import type { BrainUsed } from "@/lib/brain/context/types";
import {
  brainstorm,
  type ChatMessage,
  type ClipContext,
} from "@/lib/content/brainstorm";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

export interface ClipBrainstorm {
  messages: ChatMessage[];
  clip: ClipContext;
  /** Pillar names a client knows, used only when the Brain has none. */
  pillars: string[];
}

/**
 * One turn of the "make your own from this clip" chat, billed as
 * `brainstorm` and refunded when the writing fails. The Inspiration chat
 * and Chirpy's studio.inspiration.brainstorm share it. `request` only
 * identifies the caller for the provider spend limit.
 */
export async function brainstormClip(
  request: Request,
  userId: string,
  input: ClipBrainstorm,
  signal?: AbortSignal,
): Promise<
  OperationResult<{ reply: string; balance: number; used: BrainUsed }>
> {
  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");
  const billing = await preflightPaidActionOrResponse(userId, "brainstorm");
  if (billing) return refusedBy(billing);

  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "content-brainstorm",
  );
  if (spendLimited) return refusedBy(spendLimited);
  const access = await reservePaidActionOrResponse(userId, "brainstorm");
  if (access.response) return refusedBy(access.response);
  const { reservation } = access;

  const { messages, clip } = input;
  // Read server-side: a client must not be able to claim a different voice.
  const context = await getBrainContextSafe(userId, {
    surface: "ideate",
    memoryTask: messages.findLast((message) => message.role === "user")
      ?.content,
    // The clip being riffed on plus what has just been said about it. The last
    // turn matters more than the first, which is why only the tail is sent.
    task: [clip.title, ...messages.slice(-3).map((message) => message.content)]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000),
    signal,
  });
  try {
    const reply = await brainstorm(
      {
        messages,
        clip,
        pillars: context.pillarNames.length
          ? context.pillarNames
          : input.pillars,
        context: context.section,
      },
      signal,
    );
    return succeeded({
      reply,
      balance: reservation.balance,
      used: context.used,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "brainstorm_failed";
    await refundCreditReservation(userId, reservation, detail);
    return refused(502, "brainstorm_failed", detail);
  }
}
