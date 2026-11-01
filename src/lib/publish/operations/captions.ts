import {
  preflightPaidActionOrResponse,
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getBrainContextSafe } from "@/lib/brain/context/server";
import { getContentItem } from "@/lib/db/content";
import { hookTexts, normalizeBody } from "@/lib/content/normalize";
import { loadRecordedTranscript } from "@/lib/content/recorded-transcript";
import type { PublishPlatform } from "@/lib/db/schema";
import {
  refused,
  refusedBy,
  succeeded,
  type OperationResult,
} from "@/lib/http/operation-result";
import { generateCaptions, type PlatformCaption } from "@/lib/publish/caption";
import { collectStyleSamples } from "@/lib/publish/caption-style";
import { guardProviderSpend } from "@/lib/provider-rate-limit";

/** What a caption request asks for, already clamped by its caller. */
export interface CaptionRequest {
  title: string;
  platforms: PublishPlatform[];
  titleOnly?: boolean;
  contentItemId?: string;
  transcript?: string;
  videoDescription?: string;
  captionReference?: string;
  context?: string;
  instructions?: string;
  sourceCaption?: string;
  matchStyle?: boolean;
}

export interface WrittenCaptions {
  captions: PlatformCaption[];
  balance: number;
  used: Awaited<ReturnType<typeof getBrainContextSafe>>["used"];
}

/**
 * Draft one caption per platform being posted to, billed as `publish_caption`
 * and refunded when the writing fails. Poster (through /api/publish/caption)
 * and Chirpy share it. `request` only identifies the caller for the provider
 * spend limit.
 *
 * The old version wrote a single YouTube title and description from the video
 * title alone, which Instagram then pasted together and TikTok ignored. Two
 * things were missing and both are the difference between a caption about this
 * video and a caption about its title: the creator's standing context (voice,
 * audience, offers, never-say), which every other AI call in the app already
 * receives, and the video's own script.
 *
 * Charge-on-success: generate first, refund on failure, so nothing is billed
 * for an empty result.
 */
export async function chargedCaptions(
  request: Request,
  userId: string,
  input: CaptionRequest,
  signal?: AbortSignal,
): Promise<OperationResult<WrittenCaptions>> {
  if (!process.env.SURPLUS_API_KEY) return refused(501, "no_provider");
  const billing = await preflightPaidActionOrResponse(
    userId,
    "publish_caption",
  );
  if (billing) return refusedBy(billing);

  const spendLimited = await guardProviderSpend(
    request,
    userId,
    "publish-caption",
  );
  if (spendLimited) return refusedBy(spendLimited);
  const access = await reservePaidActionOrResponse(userId, "publish_caption");
  if (access.response) return refusedBy(access.response);
  const { reservation } = access;

  try {
    // The library item carries what the video actually says. Read server-side and
    // scoped to the caller, so a client cannot caption someone else's script.
    let script: string | undefined;
    let hook: string | undefined;
    let originalNote: string | undefined;
    let spoken = input.transcript;
    let pillar: string | undefined;
    if (input.contentItemId) {
      const item = await getContentItem(userId, input.contentItemId);
      if (item) {
        script = item.script ?? undefined;
        // What was actually said beats what was planned. The inspiration's own
        // transcript is someone else's video and is never captioned from.
        spoken = (await loadRecordedTranscript(userId, item)) ?? undefined;
        hook = hookTexts(normalizeBody(item).hooks)[0];
        originalNote = item.originalNote || undefined;
        pillar = item.pillar ?? undefined;
      }
    }

    const styleSamples = input.matchStyle
      ? await collectStyleSamples(userId, input.platforms)
      : undefined;

    const brain = await getBrainContextSafe(userId, {
      surface: "caption",
      task: [
        input.title,
        input.videoDescription,
        input.captionReference?.slice(0, 1200),
        hook,
        (spoken ?? script)?.slice(0, 1200),
        pillar,
      ]
        .filter(Boolean)
        .join("\n"),
      signal,
    });

    const captions = await generateCaptions(
      {
        title: input.title,
        videoDescription: input.videoDescription,
        captionReference: input.captionReference,
        context: brain.section,
        hook,
        script: spoken ?? script,
        // The item's own words win; the client's free-text context is the
        // fallback for a video with no library row behind it.
        originalNote: originalNote ?? input.context,
        pillar,
        platforms: input.platforms,
        styleSamples,
        instructions: input.instructions,
        sourceCaption: input.sourceCaption,
        titleOnly: input.titleOnly === true,
      },
      signal,
    );
    return succeeded({
      captions,
      balance: reservation.balance,
      used: brain.used,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "generate_failed";
    await refundCreditReservation(userId, reservation, detail);
    if (detail === "no_provider") return refused(501, "no_provider");
    console.error("[publish] caption generation failed", e);
    return refused(502, "generate_failed");
  }
}
