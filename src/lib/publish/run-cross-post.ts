import type { PublishPlatform } from "@/lib/db/schema";
import type { CrossPostResult } from "@/lib/publish/client";

export type CrossPostStatus = "posted" | "draft" | "failed";

/** What happened on one platform in a fan-out. `url` is present for a live post
 * that landed somewhere linkable; `error` for a failure. */
export interface CrossPostOutcome {
  platform: PublishPlatform;
  status: CrossPostStatus;
  url?: string;
  error?: string;
}

/**
 * Post to every target, isolating failures so one platform going down never
 * blocks the others (Promise.allSettled, not all). Each target posts through
 * the injected `post` fn (the real per-platform client call in production, a
 * stub in tests), and its result maps to a status: a draft-inbox landing
 * (TikTok) is `draft`, a live post is `posted`, a thrown error is `failed`.
 * Output order matches `targets`, so a preview and its results line up.
 */
export async function runCrossPost(
  targets: { platform: PublishPlatform }[],
  post: (platform: PublishPlatform) => Promise<CrossPostResult>,
): Promise<CrossPostOutcome[]> {
  const settled = await Promise.allSettled(
    targets.map((t) => post(t.platform)),
  );
  return settled.map((s, i) => {
    const platform = targets[i].platform;
    if (s.status === "fulfilled") {
      return {
        platform,
        status: s.value.draft ? "draft" : "posted",
        url: s.value.url,
      };
    }
    return {
      platform,
      status: "failed",
      error: s.reason instanceof Error ? s.reason.message : "failed",
    };
  });
}

/** Tally a fan-out's outcomes for the closing summary line. */
export function crossPostOutcomeSummary(outcomes: CrossPostOutcome[]): {
  posted: number;
  draft: number;
  failed: number;
} {
  let posted = 0;
  let draft = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o.status === "posted") posted += 1;
    else if (o.status === "draft") draft += 1;
    else failed += 1;
  }
  return { posted, draft, failed };
}
