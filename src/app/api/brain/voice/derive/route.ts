import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { getActiveProject, updateProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { readyVoiceTranscripts } from "@/lib/db/voice-samples";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import { deriveVoice } from "@/lib/voice/derive";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Rewrites the voice profile and scripting patterns from the current sample
 * set. What you make and who it is for are drafted only while still blank,
 * so a creator's own words there are never overwritten. Free: the credits
 * were spent listening.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;
  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "brain-voice-derive",
  );
  if (spendLimited) return spendLimited;

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const samples = await readyVoiceTranscripts(project.id);
  if (samples.length === 0) {
    return Response.json({ error: "no_samples" }, { status: 400 });
  }

  try {
    const derived = await deriveVoice(samples, req.signal);
    const patch: Record<string, string> = {};
    if (derived.voice) patch.voice = derived.voice;
    if (derived.scriptingPatterns)
      patch.scriptingPatterns = derived.scriptingPatterns;
    if (derived.whatIMake && !project.whatIMake.trim())
      patch.whatIMake = derived.whatIMake;
    if (derived.audience && !project.audience.trim())
      patch.audience = derived.audience;
    await updateProject(userId, patch);
    invalidateBrainContext(project.id);
    return Response.json({ applied: patch, samples: samples.length });
  } catch (error) {
    console.error("[voice] derive failed", error);
    return Response.json({ error: "derive_failed" }, { status: 502 });
  }
}
