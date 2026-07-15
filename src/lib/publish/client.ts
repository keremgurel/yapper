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
}

export async function fetchYouTubeVideos(): Promise<{
  connected: boolean;
  videos: PlatformVideo[];
}> {
  try {
    const res = await fetch("/api/publish/youtube/videos");
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

export interface CrossPostInput {
  submissionId: string;
  title: string;
  description?: string;
  contentItemId?: string;
}

export interface InstagramPostInput {
  submissionId: string;
  caption?: string;
  contentItemId?: string;
}

export interface TikTokPostInput {
  submissionId: string;
  contentItemId?: string;
}

/** The shape every platform's post resolves to. `url` is present when the post
 * lands somewhere linkable (YouTube, Instagram); `draft` is true when it lands
 * in the app's drafts to finish there (TikTok), which has no URL yet. */
export interface CrossPostResult {
  jobId: string;
  url?: string;
  draft?: boolean;
}

export async function generateCaption(input: {
  title: string;
  context?: string;
  matchStyle: boolean;
}): Promise<{ title: string; description: string }> {
  const res = await fetch("/api/publish/caption", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(res.status === 501 ? "no_provider" : "failed");
  }
  const data = (await res.json()) as {
    caption: { title: string; description: string };
  };
  return data.caption;
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
