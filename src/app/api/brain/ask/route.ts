import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { askBrain, type AskMessage } from "@/lib/brain/ask";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const asMessages = (value: unknown): AskMessage[] =>
  Array.isArray(value)
    ? value
        .filter(
          (message): message is AskMessage =>
            !!message &&
            typeof message === "object" &&
            ((message as AskMessage).role === "user" ||
              (message as AskMessage).role === "assistant") &&
            typeof (message as AskMessage).content === "string",
        )
        .slice(-12)
    : [];

/** Ask the brain a question, and let it offer what it learned back. */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const messages = asMessages(body.messages);
  if (!messages.length)
    return Response.json({ error: "no_message" }, { status: 400 });

  if (!process.env.SURPLUS_API_KEY) {
    return Response.json({ error: "no_provider" }, { status: 501 });
  }
  const billing = await preflightPaidActionOrResponse(userId, "brainstorm");
  if (billing) return billing;

  const spendLimited = await guardProviderSpend(req, userId, "brain-ask");
  if (spendLimited) return spendLimited;
  const access = await reservePaidActionOrResponse(userId, "brainstorm");
  if (access.response) return access.response;
  const { reservation } = access;

  // Read server-side: a client must not be able to claim a different brain, and
  // loaded after the gates so a refused request never routes.
  // The coach is the one surface where the creator may be asking about a
  // specific section by name, so the whole last turn is the routing signal.
  const context = await getBrainContextSafe(userId, {
    surface: "chat",
    task: messages
      .slice(-2)
      .map((message) => message.content)
      .join("\n")
      .slice(0, 2000),
    signal: req.signal,
  });
  try {
    const answer = await askBrain(
      {
        messages,
        context: context.section,
        pillars: context.pillarNames,
      },
      req.signal,
    );
    return Response.json({ ...answer, used: context.used });
  } catch (error) {
    await refundCreditReservation(userId, reservation, "ask_failed");
    console.error("[brain/ask] failed", error);
    return Response.json({ error: "ask_failed" }, { status: 502 });
  }
}
