import { isMomentKind, type MomentKind } from "./moment-kinds";
import {
  cleanOverlayDescription,
  cleanOverlayName,
  uniqueOverlayName,
} from "./overlay-name";
import { extractJsonObject, replyString } from "./reply-json";

export interface DirectMoment {
  /** Words copied from the transcript, marking where the visual belongs. */
  quote: string;
  /** The word inside the quote it should appear on, when one was named. */
  cue?: string;
  brief: string;
  name: string;
  description: string;
  kind: MomentKind;
  wantsImage: boolean;
  aspect?: number;
}

export interface DirectReply {
  moments: DirectMoment[];
  considered: number;
  passedOn: string;
}

export interface DirectReplyContext {
  /** Names of overlays already on the timeline. */
  placedNames: readonly string[];
  /** Names already in the media library. */
  takenNames: readonly string[];
  instruction?: string;
}

/** More than this from one pass is over-placement whatever the transcript. */
const MAX_MOMENTS = 12;

export function requestedMomentLimit(instruction: string): number {
  return /\b(?:create|make|generate|design|add)\s+(?:me\s+)?(?:an?|one|single)\s+(?:(?:animated|static|custom|new|simple|branded)\s+){0,3}(?:overlay|visual|graphic|animation)\b/i.test(
    instruction,
  )
    ? 1
    : MAX_MOMENTS;
}

/**
 * Pull the moments out of the editorial pass. A moment without a quote or a
 * brief is dropped here: the first is where it goes and the second is what
 * to design, and neither can be made up downstream.
 */
export function parseDirectReply(
  content: string,
  context: DirectReplyContext,
): DirectReply {
  const parsed = extractJsonObject(content);
  const empty: DirectReply = { moments: [], considered: 0, passedOn: "" };
  if (!parsed) return empty;
  const taken = [...context.takenNames, ...context.placedNames];
  const moments: DirectMoment[] = [];
  const limit = requestedMomentLimit(context.instruction ?? "");
  for (const entry of Array.isArray(parsed.moments) ? parsed.moments : []) {
    if (moments.length >= limit) break;
    if (entry == null || typeof entry !== "object") continue;
    const raw = entry as Record<string, unknown>;
    const quote = replyString(raw.quote, 400);
    const brief = replyString(raw.brief, 600);
    if (!quote || !brief) continue;
    const name = uniqueOverlayName(
      cleanOverlayName(raw.name, { brief, quote }),
      taken,
      quote,
    );
    taken.push(name);
    moments.push({
      quote,
      cue: replyString(raw.cue, 80),
      brief,
      name,
      description: cleanOverlayDescription(raw.description),
      kind: isMomentKind(raw.kind) ? raw.kind : "other",
      wantsImage: raw.wantsImage === true,
      ...(typeof raw.aspect === "number" &&
      Number.isFinite(raw.aspect) &&
      raw.aspect >= 0.2 &&
      raw.aspect <= 5
        ? { aspect: raw.aspect }
        : {}),
    });
  }
  const considered =
    typeof parsed.considered === "number" && Number.isFinite(parsed.considered)
      ? Math.max(moments.length, Math.min(999, Math.round(parsed.considered)))
      : moments.length;
  return {
    moments,
    considered,
    passedOn: replyString(parsed.passedOn, 240) ?? "",
  };
}
