export interface TikTokListVideo {
  id?: string;
  title?: string;
  video_description?: string;
  create_time?: number;
  cover_image_url?: string;
  share_url?: string;
  view_count?: number;
}

export interface TikTokVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  privacyStatus: string;
  url: string;
}

/** Map Display API metadata into the same platform-library shape as YouTube
 * and Instagram. TikTok exposes public post metadata, not source video bytes. */
export function mapTikTokVideos(videos: TikTokListVideo[]): TikTokVideo[] {
  return videos
    .filter((video): video is TikTokListVideo & { id: string } =>
      Boolean(video.id),
    )
    .map((video) => ({
      id: video.id,
      title:
        video.title?.trim() || video.video_description?.trim() || "Untitled",
      thumbnail: video.cover_image_url ?? null,
      viewCount: Number(video.view_count ?? 0),
      publishedAt: video.create_time
        ? new Date(video.create_time * 1000).toISOString()
        : "",
      privacyStatus: "public",
      url: video.share_url ?? `https://www.tiktok.com/video/${video.id}`,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function listTikTokVideos(
  accessToken: string,
): Promise<TikTokVideo[]> {
  const fields = [
    "id",
    "title",
    "video_description",
    "create_time",
    "cover_image_url",
    "share_url",
    "view_count",
  ].join(",");
  const response = await fetch(
    `https://open.tiktokapis.com/v2/video/list/?fields=${fields}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ max_count: 20 }),
    },
  );
  if (!response.ok) throw new Error(`tiktok_video_list_${response.status}`);
  const json = (await response.json()) as {
    data?: { videos?: TikTokListVideo[] };
    error?: { code?: string; message?: string };
  };
  if (json.error?.code && json.error.code !== "ok") {
    throw new Error(`tiktok_video_list_${json.error.code}`);
  }
  return mapTikTokVideos(json.data?.videos ?? []);
}
