import { facebookRequest } from "./facebook-api";
import type { PlatformVideo } from "./client";
export async function listFacebookVideos(
  pageId: string,
  token: string,
): Promise<PlatformVideo[]> {
  const response = await facebookRequest<{
    data?: { id: string; description?: string; updated_time?: string }[];
  }>(
    `${encodeURIComponent(pageId)}/video_reels?fields=id,description,updated_time&limit=50`,
    token,
  );
  return (response.data ?? [])
    .filter((video) => /^\d+$/.test(video.id))
    .map((video) => ({
      id: video.id,
      title: video.description?.split("\n")[0] ?? "Untitled Reel",
      caption: video.description ?? "",
      thumbnail: null,
      viewCount: 0,
      publishedAt: video.updated_time ?? "",
      privacyStatus: "public",
      url: `https://www.facebook.com/reel/${video.id}`,
    }));
}
