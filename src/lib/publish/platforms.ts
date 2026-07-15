import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

/**
 * What "post" actually does on a platform, because it is not the same promise
 * everywhere:
 * - `direct`: the API posts straight to the feed (YouTube Shorts, Instagram
 *   Reels). Still gated by the platform's own rules (see `requiresProfessional`
 *   and each platform's audit state) but no manual step in the app.
 * - `draft-inbox`: lands in the user's drafts/inbox; they tap publish in the
 *   app (TikTok, until the app passes TikTok's direct-post audit).
 */
export type PublishMode = "direct" | "draft-inbox";

export interface PlatformSpec {
  id: PublishPlatform;
  label: string;
  mode: PublishMode;
  /** OAuth scopes requested at connect time. */
  scopes: string[];
  /** The platform fetches the video from a public URL instead of taking bytes. */
  needsPublicUrl: boolean;
  /**
   * The account must be a Professional account (Business OR Creator). This is
   * Instagram's real gate: OAuth succeeds on a personal account but the
   * Content Publishing API rejects it. Not "business only" — Creator works too.
   */
  requiresProfessional: boolean;
  /** Env var names that must be set for this platform to be usable. */
  env: { clientId: string; clientSecret: string };
  /** One-line, user-facing truth about what pressing "post" does here. */
  postMeaning: string;
}

/**
 * The single source of truth for the three platforms. The OAuth flow reads
 * `scopes` and `env`, the publish pipeline reads `mode` and `needsPublicUrl`,
 * and the UI reads `label`, `postMeaning`, and `requiresProfessional`.
 */
export const PLATFORMS: Record<PublishPlatform, PlatformSpec> = {
  youtube: {
    id: "youtube",
    label: "YouTube",
    mode: "direct",
    scopes: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
    needsPublicUrl: false,
    requiresProfessional: false,
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
    requiresProfessional: false,
    env: {
      clientId: "TIKTOK_CLIENT_KEY",
      clientSecret: "TIKTOK_CLIENT_SECRET",
    },
    postMeaning: "Sends to your TikTok drafts to finish in the app.",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    mode: "direct",
    // Instagram API with Instagram Login: the user logs in with Instagram
    // directly, no linked Facebook Page needed. The account must be Professional.
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    needsPublicUrl: true,
    requiresProfessional: true,
    env: {
      clientId: "INSTAGRAM_APP_ID",
      clientSecret: "INSTAGRAM_APP_SECRET",
    },
    postMeaning: "Posts a Reel (needs a Business or Creator account).",
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
