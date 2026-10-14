import type { PublishPlatform } from "@/lib/db/schema";

/** Product rollout, separate from the persisted enum and retained integrations.
 * Facebook is paused. Re-enable here and in the native enabledCases together.
 */
export const enabledPublishPlatforms: readonly PublishPlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
];

export function isPlatformEnabled(
  platform: string,
): platform is PublishPlatform {
  return (enabledPublishPlatforms as readonly string[]).includes(platform);
}

export function platformPausedResponse(): Response {
  return Response.json({ error: "platform_paused" }, { status: 409 });
}
