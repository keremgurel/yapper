import { captionSpec } from "@/lib/publish/caption-specs";
import { renderCaption, type PlatformCaption } from "@/lib/publish/caption";
import { PLATFORMS } from "@/lib/publish/platforms";
import type { PublishPlatform } from "@/lib/db/schema";

/**
 * Whether one video is ready to go to one platform, and if not, why.
 *
 * Cross-posting is not one post with one caption. It is N posts derived from
 * one video, each with its own limits, its own required fields and its own way
 * of failing. The old Poster hid all of that behind a single publish button,
 * so the first time anyone learned that YouTube wants a title or that TikTok
 * only ever lands in drafts was after pressing it.
 *
 * Everything here is derived from `CAPTION_SPECS` and `PLATFORMS`, which
 * already held the truth. This just makes it answerable per destination.
 */

export type DestinationState =
  | "disconnected"
  | "empty"
  | "blocked"
  | "ready"
  | "scheduled"
  | "posted"
  | "failed";

export interface DestinationReadiness {
  platform: PublishPlatform;
  label: string;
  state: DestinationState;
  /** Why it cannot go. Empty when the state is ready or better. */
  blockers: string[];
  /** True things worth knowing that do not stop the post. */
  notes: string[];
  /** Live counts, so the card can show usage before it becomes a blocker. */
  title: { used: number; max: number; applies: boolean };
  body: { used: number; max: number };
  /** How much of the body shows before the platform collapses it. */
  visibleChars: number;
  hashtags: { used: number; min: number; max: number };
}

export interface DestinationInput {
  platform: PublishPlatform;
  connected: boolean;
  caption: PlatformCaption;
  /** A cover is only genuinely required where the platform has no frame to fall back on. */
  hasCover: boolean;
  /** Set once the job has left the app, so the card stops offering to send it again. */
  outcome?: "scheduled" | "posted" | "failed";
  outcomeDetail?: string;
}

export function evaluateDestination(
  input: DestinationInput,
): DestinationReadiness {
  const spec = captionSpec(input.platform);
  const platform = PLATFORMS[input.platform];
  const body = renderCaption(input.caption);

  const readiness: DestinationReadiness = {
    platform: input.platform,
    label: spec.label,
    state: "empty",
    blockers: [],
    notes: [],
    title: {
      used: input.caption.title.trim().length,
      max: spec.titleMax,
      applies: spec.hasTitle,
    },
    body: { used: body.length, max: spec.bodyMax },
    visibleChars: spec.visibleChars,
    hashtags: {
      used: input.caption.hashtags.length,
      min: spec.hashtags.min,
      max: spec.hashtags.max,
    },
  };

  // A finished job outranks everything: there is nothing to fix on a post that
  // has already gone.
  if (input.outcome) {
    readiness.state = input.outcome;
    if (input.outcomeDetail) readiness.notes.push(input.outcomeDetail);
    return readiness;
  }

  if (!input.connected) {
    readiness.state = "disconnected";
    readiness.blockers.push(`Connect your ${platform.label} account first.`);
    return readiness;
  }

  // What "post" means here differs per platform, and it is the single most
  // surprising thing about cross-posting, so it is always stated.
  readiness.notes.push(platform.postMeaning);
  if (platform.requiresProfessional) {
    readiness.notes.push(
      "Needs a Professional account (Business or Creator). A personal account connects but cannot publish.",
    );
  }

  const hasBody = body.trim().length > 0;
  const hasTitle = readiness.title.used > 0;
  if (!hasBody && !(spec.hasTitle && hasTitle)) {
    readiness.state = "empty";
    return readiness;
  }

  if (spec.hasTitle && !hasTitle) {
    readiness.blockers.push("A title is required.");
  }
  if (spec.hasTitle && readiness.title.used > spec.titleMax) {
    readiness.blockers.push(
      `Title is ${readiness.title.used - spec.titleMax} over the ${spec.titleMax} limit.`,
    );
  }
  if (readiness.body.used > spec.bodyMax) {
    readiness.blockers.push(
      `Caption is ${readiness.body.used - spec.bodyMax} over the ${spec.bodyMax} limit.`,
    );
  }
  if (!input.hasCover && spec.hasTitle) {
    // Only where the platform shows a chosen thumbnail rather than a frame.
    readiness.blockers.push("Pick a cover image.");
  }

  if (readiness.hashtags.used < spec.hashtags.min) {
    readiness.notes.push(
      `${spec.hashtags.min} to ${spec.hashtags.max} hashtags work best here.`,
    );
  }

  readiness.state = readiness.blockers.length > 0 ? "blocked" : "ready";
  return readiness;
}

/** What the publish button should say and whether it can be pressed. */
export function publishSummary(readiness: DestinationReadiness[]): {
  ready: number;
  blocked: number;
  canPublish: boolean;
  label: string;
} {
  const ready = readiness.filter((r) => r.state === "ready").length;
  const blocked = readiness.filter(
    (r) => r.state === "blocked" || r.state === "disconnected",
  ).length;
  return {
    ready,
    blocked,
    canPublish: ready > 0,
    label:
      ready === 0
        ? "Nothing ready to publish"
        : ready === 1
          ? "Publish to 1 destination"
          : `Publish to ${ready} destinations`,
  };
}
