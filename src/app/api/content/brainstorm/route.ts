import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  brainstorm,
  type ChatMessage,
  type ClipContext,
} from "@/lib/content/brainstorm";

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

/** Conversational ideation off a reference clip. Auth-gated, no credits (the
 * free ideation funnel; deep script generation stays gated in the workbench). */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

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

  try {
    const reply = await brainstorm({
      messages: asMessages(body.messages),
      clip,
      pillars,
    });
    return Response.json({ reply });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "brainstorm_failed";
    return Response.json(
      { error: "brainstorm_failed", detail },
      { status: 502 },
    );
  }
}
