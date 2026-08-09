import { PLATFORMS } from "@/lib/publish/platforms";

/**
 * The scopes to ask TikTok for.
 *
 * TikTok rejects the whole authorization with `scope` as the only explanation
 * when the app is asked for a scope it has not been approved for, and approval
 * is per product in their developer portal: `video.list` comes with the Display
 * API, `video.upload` with the Content Posting API, and neither is granted by
 * having the credentials. Nothing in the code can tell which of ours are live.
 *
 * So the list is configurable. `TIKTOK_SCOPES` (comma or space separated) wins
 * over the built-in set, which lets a half-approved app connect with what it
 * has instead of failing entirely, and lets the full set go back the day the
 * rest is approved. Publishing already reports what it cannot do.
 */
export function tiktokScopes(
  env: Partial<Record<string, string>> = process.env,
): string[] {
  const configured = env.TIKTOK_SCOPES?.split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (configured?.length) return configured;
  return [...PLATFORMS.tiktok.scopes];
}
