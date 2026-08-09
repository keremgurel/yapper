import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { askBrain, type AskMessage } from "@/lib/brain/ask";
import { getProjectContextSafe } from "@/lib/content/project-context-server";

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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const messages = asMessages(body.messages);
  if (!messages.length)
    return Response.json({ error: "no_message" }, { status: 400 });

  // Read server-side: a client must not be able to claim a different brain.
  const context = await getProjectContextSafe(userId);

  const access = await reservePaidActionOrResponse(userId, "brainstorm");
  if (access.response) return access.response;
  const { reservation } = access;

  try {
    const answer = await askBrain({
      messages,
      context: context.block,
      pillars: context.pillarNames,
    });
    return Response.json(answer);
  } catch (error) {
    await refundCreditReservation(userId, reservation, "ask_failed");
    console.error("[brain/ask] failed", error);
    return Response.json({ error: "ask_failed" }, { status: 502 });
  }
}
