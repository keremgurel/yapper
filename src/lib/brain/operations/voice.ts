import {
  billingAccessResponse,
  refundCreditReservation,
  reservePaidAction,
  type CreditReservation,
} from "@/lib/billing/actions";
import { canUsePremium } from "@/lib/billing/gate";
import { invalidateBrainContext } from "@/lib/brain/context/server";
import { getBalance } from "@/lib/db/credits";
import {
  bumpProjectContext,
  getActiveProject,
  updateProject,
} from "@/lib/db/projects";
import type { PublishPlatform } from "@/lib/db/schema";
import { ensureUser } from "@/lib/db/users";
import {
  deleteVoiceSample,
  readyVoiceTranscripts,
  upsertVoiceSample,
} from "@/lib/db/voice-samples";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { guardProviderSpend } from "@/lib/provider-rate-limit";
import { deriveVoice } from "@/lib/voice/derive";
import type { SampleVideoInput } from "@/lib/voice/sample-input";
import { resolveSampleSource } from "@/lib/voice/sample-media";
import { sampleView, type VoiceSampleView } from "@/lib/voice/sample-view";
import { settleSampleCredits } from "@/lib/voice/settle-credits";
import { transcribeSampleMedia } from "@/lib/voice/transcribe-sample";
import { sampleCredits, tooLong, transcriptionUnits } from "@/lib/voice/units";

const KNOWN_FAILURES = new Set([
  "no_captions",
  "no_source_file",
  "empty_transcript",
  "no_transcription_provider",
  "no_apify_token",
]);

/**
 * Listen to one of the creator's published videos and add it to the voice
 * set. Credits are reserved on the reported length (one per three minutes, at
 * least one, YouTube captions free) and settled on the length actually heard.
 * The video picker (through /api/brain/voice/samples) and Chirpy share it.
 */
export async function listenToVideo(
  request: Request,
  userId: string,
  platform: PublishPlatform,
  video: SampleVideoInput,
  signal?: AbortSignal,
): Promise<
  OperationResult<{ sample: VoiceSampleView; charged: number; balance: number }>
> {
  if (tooLong(video.durationSec)) return refused(400, "too_long");
  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "brain-voice-sample",
  );
  if (spendLimited) return refusedBy(spendLimited);

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
    if (denied) return refusedBy(denied);
    throw error;
  }

  try {
    const source = await resolveSampleSource(userId, platform, video, signal);
    const heard =
      source.kind === "transcript"
        ? { transcript: source.transcript, heardSec: video.durationSec ?? 0 }
        : await transcribeSampleMedia(source.mediaUrl, signal);

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
    return succeeded({
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
    return refused(
      502,
      KNOWN_FAILURES.has(code) ? code : "transcription_failed",
    );
  }
}

/** Take a video out of the voice set. The channel keeps it; no refund. */
export async function removeVoiceSample(
  userId: string,
  id: string,
): Promise<OperationResult<true>> {
  if (!(await deleteVoiceSample(userId, id))) return refused(404, "not_found");
  const project = await getActiveProject(userId);
  await bumpProjectContext(project.id);
  invalidateBrainContext(project.id);
  return succeeded(true);
}

/**
 * Rewrite the voice profile and scripting patterns from the current sample
 * set. What you make and who it is for are drafted only while still blank,
 * so a creator's own words there are never overwritten. Free: the credits
 * were spent listening. The voice sheet (through /api/brain/voice/derive) and
 * Chirpy share it.
 */
export async function deriveVoiceProfile(
  request: Request,
  userId: string,
  signal?: AbortSignal,
): Promise<
  OperationResult<{ applied: Record<string, string>; samples: number }>
> {
  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "brain-voice-derive",
  );
  if (spendLimited) return refusedBy(spendLimited);

  await ensureUser(userId);
  if (!(await canUsePremium(userId))) return refused(402, "not_entitled");
  const project = await getActiveProject(userId);
  const samples = await readyVoiceTranscripts(project.id);
  if (samples.length === 0) return refused(400, "no_samples");

  try {
    const derived = await deriveVoice(samples, signal);
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
    return succeeded({ applied: patch, samples: samples.length });
  } catch (error) {
    console.error("[voice] derive failed", error);
    return refused(502, "derive_failed");
  }
}
