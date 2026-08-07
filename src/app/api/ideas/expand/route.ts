import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import { expandIdea } from "@/lib/ideas/expand";
import type { IdeaInput } from "@/lib/ideas/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Expand a raw idea into a reference-specific creative dossier. The creator's
 * original words and the source transcript are preserved client-side; this only
 * builds the regenerable analysis around them.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    input?: IdeaInput;
  };
  const input = body.input;
  const hasMaterial =
    !!input &&
    (!!input.transcript?.trim() ||
      !!input.url?.trim() ||
      !!input.source?.url?.trim());
  if (!hasMaterial) {
    return Response.json({ error: "no_input" }, { status: 400 });
  }
  // The creator's standing context is read server-side rather than trusted from
  // the client, so a request cannot claim someone else's pillars or voice.
  const context = await getProjectContextSafe(userId);

  const access = await reservePaidActionOrResponse(userId, "expand_idea");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const expansion = await expandIdea(input, context);
    return Response.json({ expansion, balance: reservation.balance });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "expand_failed";
    await refundCreditReservation(userId, reservation, detail);
    const status = detail === "no_provider" ? 501 : 502;
    return Response.json({ error: "expand_failed", detail }, { status });
  }
}
