import { withProductAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import type { ChatMessage, ClipContext } from "@/lib/content/brainstorm";
import { brainstormClip } from "@/lib/content/operations/brainstorm";
import { refusalResponse } from "@/lib/http/operation-result";
import { guardProviderIngress } from "@/lib/provider-rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const asMessages = (v: unknown): ChatMessage[] =>
  Array.isArray(v)
    ? v
        .filter(
          (m): m is ChatMessage =>
            !!m &&
            typeof m === "object" &&
            (m as ChatMessage).role !== undefined &&
            typeof (m as ChatMessage).content === "string",
        )
        .slice(-12)
    : [];

/** Conversational ideation off a reference clip, one brainstorm credit per
 * reply (see brainstormClip). */
async function trackedPOST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const clip = body.clip as ClipContext | undefined;
  if (!clip || typeof clip.title !== "string") {
    return Response.json({ error: "no_clip" }, { status: 400 });
  }
  const pillars = Array.isArray(body.pillars)
    ? (body.pillars.filter((p) => typeof p === "string") as string[]).slice(
        0,
        12,
      )
    : [];

  const result = await brainstormClip(
    req,
    userId,
    { messages: asMessages(body.messages), clip, pillars },
    req.signal,
  );
  if (!result.ok) return refusalResponse(result);
  return Response.json(result.value);
}

export const POST = withProductAnalytics("clip_brainstormed", trackedPOST);
