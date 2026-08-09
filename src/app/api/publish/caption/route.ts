import { auth } from "@clerk/nextjs/server";
import {
  refundCreditReservation,
  reservePaidActionOrResponse,
} from "@/lib/billing/actions";
import { getProjectContextSafe } from "@/lib/content/project-context-server";
import { getContentItem } from "@/lib/db/content";
import { hookTexts, normalizeBody } from "@/lib/content/normalize";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { generateCaptions } from "@/lib/publish/caption";
import { collectStyleSamples } from "@/lib/publish/caption-style";

export const runtime = "nodejs";
export const maxDuration = 60;

const str = (v: unknown, max: number): string | undefined =>
  typeof v === "string" && v.trim() ? v.slice(0, max) : undefined;

function platformsOf(value: unknown): PublishPlatform[] {
  if (!Array.isArray(value)) return ["youtube"];
  const wanted = value.filter((v): v is PublishPlatform =>
    (publishPlatforms as readonly string[]).includes(v as string),
  );
  return wanted.length ? [...new Set(wanted)] : ["youtube"];
}

/**
 * Draft one caption per platform being posted to.
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
export async function POST(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = str(body.title, 300);
  if (!title) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const platforms = platformsOf(body.platforms);

  const access = await reservePaidActionOrResponse(userId, "publish_caption");
  if (access.response) return access.response;
  const { reservation } = access;

  // The library item carries what the video actually says. Read server-side and
  // scoped to the caller, so a client cannot caption someone else's script.
  let script: string | undefined;
  let hook: string | undefined;
  let originalNote: string | undefined;
  let pillar: string | undefined;
  const itemId = str(body.contentItemId, 100);
  if (itemId) {
    const item = await getContentItem(userId, itemId);
    if (item) {
      script = item.script ?? undefined;
      hook = hookTexts(normalizeBody(item).hooks)[0];
      originalNote = item.originalNote || undefined;
      pillar = item.pillar ?? undefined;
    }
  }

  const styleSamples = body.matchStyle
    ? await collectStyleSamples(userId, platforms)
    : undefined;

  try {
    const captions = await generateCaptions({
      title,
      context: (await getProjectContextSafe(userId)).block,
      hook,
      script,
      // The item's own words win; the client's free-text context is the
      // fallback for a video with no library row behind it.
      originalNote: originalNote ?? str(body.context, 2000),
      pillar,
      platforms,
      styleSamples,
    });
    return Response.json({ captions, balance: reservation.balance });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "generate_failed";
    await refundCreditReservation(userId, reservation, detail);
    if (detail === "no_provider") {
      return Response.json({ error: "no_provider" }, { status: 501 });
    }
    console.error("[publish] caption generation failed", e);
    return Response.json({ error: "generate_failed" }, { status: 502 });
  }
}
