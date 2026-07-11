import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

/**
 * What "post" actually does on a platform, because it is not the same promise
 * everywhere:
 * - `direct-public`: posts straight to the public feed (YouTube Shorts).
 * - `draft-inbox`: lands in the user's drafts; they tap publish in the app
 *   (TikTok, until the app passes TikTok's direct-post audit).
 * - `business-only`: works only for Business/Creator accounts (Instagram).
 */
export type PublishMode = "direct-public" | "draft-inbox" | "business-only";

export interface PlatformSpec {
  id: PublishPlatform;
  label: string;
  mode: PublishMode;
  /** OAuth scopes requested at connect time. */
  scopes: string[];
  /** The platform fetches the video from a public URL instead of taking bytes. */
  needsPublicUrl: boolean;
  /** Env var names that must be set for this platform to be usable. */
  env: { clientId: string; clientSecret: string };
  /** One-line, user-facing truth about what pressing "post" does here. */
  postMeaning: string;
}

/**
 * The single source of truth for the three platforms. The OAuth flow reads
 * `scopes` and `env`, the publish pipeline reads `mode` and `needsPublicUrl`,
 * and the UI reads `label` and `postMeaning`.
 */
export const PLATFORMS: Record<PublishPlatform, PlatformSpec> = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    mode: "direct-public",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    needsPublicUrl: false,
    env: {
      clientId: "YOUTUBE_CLIENT_ID",
      clientSecret: "YOUTUBE_CLIENT_SECRET",
    },
    postMeaning: "Posts a public Short.",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    mode: "draft-inbox",
    scopes: ["user.info.basic", "video.upload"],
    needsPublicUrl: false,
    env: {
      clientId: "TIKTOK_CLIENT_KEY",
      clientSecret: "TIKTOK_CLIENT_SECRET",
    },
    postMeaning: "Sends to your TikTok drafts to finish in the app.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    mode: "business-only",
    scopes: ["instagram_basic", "instagram_content_publish", "pages_show_list"],
    needsPublicUrl: true,
    env: {
      clientId: "INSTAGRAM_APP_ID",
      clientSecret: "INSTAGRAM_APP_SECRET",
    },
    postMeaning: "Posts a Reel (Business or Creator accounts only).",
  },
};

export function platformSpec(platform: PublishPlatform): PlatformSpec {
  return PLATFORMS[platform];
}

/** True once both of a platform's OAuth credentials are present in the env. */
export function isPlatformConfigured(platform: PublishPlatform): boolean {
  const { clientId, clientSecret } = PLATFORMS[platform].env;
  return !!process.env[clientId] && !!process.env[clientSecret];
}

/** The platforms a user could actually connect right now, given the env. */
export function configuredPlatforms(): PublishPlatform[] {
  return publishPlatforms.filter(isPlatformConfigured);
}
