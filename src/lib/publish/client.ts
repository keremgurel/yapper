import type { PlatformCaption } from "@/lib/publish/caption-prompt";
import type { PublishPlatform } from "@/lib/db/schema";

/** A platform connection as the UI sees it (never any token). */
export interface ConnectionSummary {
  platform: PublishPlatform;
  handle: string | null;
  externalAccountId: string | null;
  status: string;
  updatedAt: string;
}

export interface ConnectionsResponse {
  connections: ConnectionSummary[];
  /** Platforms that are actually connectable (OAuth app + token key set). */
  available: PublishPlatform[];
}

export async function fetchConnections(): Promise<ConnectionsResponse> {
  const res = await fetch("/api/publish/connections");
  if (!res.ok) throw new Error(`connections_${res.status}`);
  return (await res.json()) as ConnectionsResponse;
}

export async function disconnectPlatform(
  platform: PublishPlatform,
): Promise<void> {
  const res = await fetch(`/api/publish/connections/${platform}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`disconnect_${res.status}`);
}

/** The connect flow is a full-page redirect to the provider's consent screen. */
export function connectUrl(platform: PublishPlatform): string {
  return `/api/publish/connect/${platform}`;
}

export interface PlatformVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  privacyStatus: string;
  url: string;
  /** The downloadable source file, present only for platforms we can backfill
   * from (Instagram). Absent for YouTube and TikTok, whose APIs do not hand
   * back a file, so those rows are view-only. */
  sourceFileUrl?: string;
  /** Original source retained by Yapper when this post was published through
   * the app. Unlike a platform transcode, it can be posted elsewhere intact. */
  mediaKey?: string;
  sourcePlatform?: PublishPlatform;
}

/** A connected platform's own videos. `/api/publish/<platform>/videos` returns
 * `connected: false` rather than erroring when the platform is not linked. */
export async function fetchPlatformVideos(platform: PublishPlatform): Promise<{
  connected: boolean;
  videos: PlatformVideo[];
}> {
  try {
    // Channel libraries are live provider data. Never let the browser reuse a
    // response after the creator has published something in another app.
    const res = await fetch(`/api/publish/${platform}/videos`, {
      cache: "no-store",
    });
    if (!res.ok) return { connected: false, videos: [] };
    return (await res.json()) as {
      connected: boolean;
      videos: PlatformVideo[];
    };
  } catch {
    // A network error (offline, DNS, CORS) or a non-JSON body would otherwise
    // reject. The videos hook keys loading off `videos === null`, so a rejection
    // leaves the Posts tab spinning forever. Fail to the same empty shape a
    // non-ok response already yields.
    return { connected: false, videos: [] };
  }
}

/** YouTube's own uploads. Kept as a named alias for the existing content hub. */
export function fetchYouTubeVideos(): Promise<{
  connected: boolean;
  videos: PlatformVideo[];
}> {
  return fetchPlatformVideos("youtube");
}

/** A post's source is either a Yapper recording (`submissionId`) or a raw R2
 * key (`mediaKey`) for an uploaded or imported video. Exactly one is set. */
export interface CrossPostInput {
  submissionId?: string;
  mediaKey?: string;
  title: string;
  description?: string;
  contentItemId?: string;
  /** R2 key of a custom thumbnail/cover image, if the user picked one. */
  thumbnailKey?: string;
  privacyStatus?: "private" | "unlisted" | "public";
}

export interface InstagramPostInput {
  submissionId?: string;
  mediaKey?: string;
  caption?: string;
  contentItemId?: string;
  thumbnailKey?: string;
}

export interface TikTokPostInput {
  submissionId?: string;
  mediaKey?: string;
  contentItemId?: string;
}

/** Pull an Instagram video into the user's own storage so it can be cross-posted
 * elsewhere. Returns the R2 key of the stored file plus a suggested title. */
export async function importInstagramMedia(
  mediaId: string,
): Promise<{ mediaKey: string; title: string }> {
  const res = await fetch("/api/publish/instagram/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaId }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "import_failed");
  }
  return (await res.json()) as { mediaKey: string; title: string };
}

/** The shape every platform's post resolves to. `url` is present when the post
 * lands somewhere linkable (YouTube, Instagram); `draft` is true when it lands
 * in the app's drafts to finish there (TikTok), which has no URL yet. */
export interface CrossPostResult {
  jobId: string;
  url?: string;
  draft?: boolean;
}

/** Draft one caption per platform. `contentItemId` is what lets the server
 * read the video's own script, which is the difference between a caption about
 * this video and a caption about its title. */
export async function generateCaptions(input: {
  title: string;
  platforms: PublishPlatform[];
  contentItemId?: string;
  context?: string;
  matchStyle: boolean;
}): Promise<PlatformCaption[]> {
  const res = await fetch("/api/publish/caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(res.status === 501 ? "no_provider" : "failed");
  }
  const data = (await res.json()) as { captions: PlatformCaption[] };
  return data.captions;
}

/** Compatibility for the existing single-platform composers while they move
 * to the multi-platform draft UI. */
export async function generateCaption(input: {
  title: string;
  context?: string;
  matchStyle: boolean;
  contentItemId?: string;
}): Promise<{ title: string; description: string }> {
  const [caption] = await generateCaptions({
    ...input,
    platforms: ["youtube"],
  });
  if (!caption) throw new Error("caption_empty");
  const hashtags = caption.hashtags.map((tag) => `#${tag}`).join(" ");
  return {
    title: caption.title,
    description: [caption.body, hashtags].filter(Boolean).join("\n\n"),
  };
}

export async function crossPostToYouTube(
  input: CrossPostInput,
): Promise<CrossPostResult> {
  const res = await fetch("/api/publish/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) throw new Error("not_connected");
  if (!res.ok) throw new Error("post_failed");
  return (await res.json()) as CrossPostResult;
}

export async function crossPostToInstagram(
  input: InstagramPostInput,
): Promise<CrossPostResult> {
  const res = await fetch("/api/publish/instagram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) throw new Error("not_connected");
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    // A personal account OAuths fine but the publish call rejects it.
    throw new Error(
      data.error === "not_professional" ? "not_professional" : "post_failed",
    );
  }
  return (await res.json()) as CrossPostResult;
}

export async function crossPostToTikTok(
  input: TikTokPostInput,
): Promise<CrossPostResult> {
  const res = await fetch("/api/publish/tiktok", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 409) throw new Error("not_connected");
  if (!res.ok) throw new Error("post_failed");
  return (await res.json()) as CrossPostResult;
}
