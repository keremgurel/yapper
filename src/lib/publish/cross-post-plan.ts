import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS, type PublishMode } from "@/lib/publish/platforms";

/** One platform a "post to all" fan-out will target, annotated with what
 * posting there actually does so the UI can preview it honestly before anything
 * goes out. */
export interface CrossPostTarget {
  platform: PublishPlatform;
  label: string;
  /** `direct` posts to the feed; `draft-inbox` lands in the platform's drafts. */
  mode: PublishMode;
  /** One-line, user-facing truth about what pressing "post" does here. */
  postMeaning: string;
  /** Instagram's gate: OAuth succeeds on a personal account but publishing 400s. */
  requiresProfessional: boolean;
}

/**
 * The targets of a single "post to all" action: every connected platform, in
 * the canonical platform order (not whatever order the connections came back
 * in), deduped, and annotated from the platform spec. Unknown platform ids are
 * dropped rather than trusted. Pure, so the fan-out preview and the posting loop
 * agree on exactly what will happen.
 */
export function crossPostTargets(
  connected: PublishPlatform[],
): CrossPostTarget[] {
  const set = new Set(connected);
  return publishPlatforms
    .filter((p) => set.has(p))
    .map((p) => {
      const spec = PLATFORMS[p];
      return {
        platform: p,
        label: spec.label,
        mode: spec.mode,
        postMeaning: spec.postMeaning,
        requiresProfessional: spec.requiresProfessional,
      };
    });
}

/** A short, honest summary of what "post to all" will do across the targets:
 * how many post straight to the feed and how many only land in drafts. Used for
 * the button's confirm line so a draft-inbox platform is never a surprise. */
export function crossPostSummary(targets: CrossPostTarget[]): {
  total: number;
  direct: number;
  draftInbox: number;
} {
  let direct = 0;
  let draftInbox = 0;
  for (const t of targets) {
    if (t.mode === "draft-inbox") draftInbox += 1;
    else direct += 1;
  }
  return { total: targets.length, direct, draftInbox };
}
