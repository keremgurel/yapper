import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import {
  billingAccessResponse,
  refundCreditReservation,
  reservePaidAction,
  type CreditReservation,
} from "@/lib/billing/actions";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { getBalance } from "@/lib/db/credits";
import { bumpProjectContext, getActiveProject } from "@/lib/db/projects";
import { ensureUser } from "@/lib/db/users";
import { upsertVoiceSample } from "@/lib/db/voice-samples";
import {
  guardProviderIngress,
  guardProviderSpend,
} from "@/lib/provider-rate-limit";
import { parseSampleRequest } from "@/lib/voice/sample-input";
import { resolveSampleSource } from "@/lib/voice/sample-media";
import { sampleView } from "@/lib/voice/sample-view";
import { settleSampleCredits } from "@/lib/voice/settle-credits";
import { transcribeSampleMedia } from "@/lib/voice/transcribe-sample";
import { sampleCredits, tooLong, transcriptionUnits } from "@/lib/voice/units";

export const runtime = "nodejs";
export const maxDuration = 300;

const KNOWN_FAILURES = new Set([
  "no_captions",
  "no_source_file",
  "empty_transcript",
  "no_transcription_provider",
  "no_apify_token",
]);

/**
 * Listens to one of the creator's published videos.
 *
 * One video per request, so a long one has the whole budget and the client
 * can show progress per video. Credits are reserved on the reported length
 * (one per three minutes, at least one, YouTube captions free) and settled on
 * the length actually heard.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const ingressLimited = await guardProviderIngress(req);
  if (ingressLimited) return ingressLimited;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = parseSampleRequest(body);
  if (!parsed) return Response.json({ error: "bad_request" }, { status: 400 });
  const { platform, video } = parsed;
  if (tooLong(video.durationSec)) {
    return Response.json({ error: "too_long" }, { status: 400 });
  }

  const spendLimited = await guardProviderSpend(
    req,
    userId,
    "brain-voice-sample",
  );
  if (spendLimited) return spendLimited;

  await ensureUser(userId);
  const project = await getActiveProject(userId);
  const cost = sampleCredits(platform, video.durationSec);
  let reservation: CreditReservation | null = null;
  try {
    reservation =
      cost > 0
        ? await reservePaidAction(userId, "voice_sample", { quantity: cost })
        : null;
  } catch (error) {
    const denied = billingAccessResponse(error);
    if (denied) return denied;
    throw error;
  }

  try {
    const source = await resolveSampleSource(
      userId,
      platform,
      video,
      req.signal,
    );
    const heard =
      source.kind === "transcript"
        ? { transcript: source.transcript, heardSec: video.durationSec ?? 0 }
        : await transcribeSampleMedia(source.mediaUrl, req.signal);

    const measured = heard.heardSec > 0 ? heard.heardSec : video.durationSec;
    const actualUnits =
      platform === "youtube" ? 0 : transcriptionUnits(measured);
    const charged = await settleSampleCredits(userId, reservation, actualUnits);

    const row = await upsertVoiceSample({
      projectId: project.id,
      userId,
      platform,
      externalPostId: video.id,
      url: video.url,
      title: video.title,
      thumbnail: video.thumbnail,
      publishedAt: video.publishedAt,
      durationSec: measured,
      transcript: heard.transcript,
      status: "ready",
      creditsCharged: charged,
      error: null,
    });
    await bumpProjectContext(project.id);
    invalidateBrainContext(project.id);
    return Response.json({
      sample: sampleView(row),
      charged,
      balance: await getBalance(userId),
    });
  } catch (error) {
    if (reservation) {
      await refundCreditReservation(userId, reservation, "voice_sample_failed");
    }
    const code = error instanceof Error ? error.message : "unknown";
    console.error("[voice] sample failed", { platform, id: video.id, code });
    return Response.json(
      { error: KNOWN_FAILURES.has(code) ? code : "transcription_failed" },
      { status: 502 },
    );
  }
}
