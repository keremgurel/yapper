/**
 * List the connected channel's own uploads with view counts, for the content
 * hub. Three calls: the channel's uploads playlist, its items, then the videos'
 * snippet + statistics. Read-only (`youtube.readonly`).
 */
export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  privacyStatus: string;
  url: string;
}

interface JsonList<T> {
  items?: T[];
}

export async function listYouTubeVideos(
  accessToken: string,
  max = 50,
): Promise<YouTubeVideo[]> {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const ch = (await getJson(
    "https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",
    headers,
    "channels",
  )) as JsonList<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
  const uploads = ch.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) return [];

  const pl = (await getJson(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=${max}&playlistId=${uploads}`,
    headers,
    "playlist",
  )) as JsonList<{ contentDetails?: { videoId?: string } }>;
  const ids = (pl.items ?? [])
    .map((i) => i.contentDetails?.videoId)
    .filter((v): v is string => !!v);
  if (ids.length === 0) return [];

  const vids = (await getJson(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status&id=${ids.join(",")}`,
    headers,
    "videos",
  )) as JsonList<{
    id?: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    statistics?: { viewCount?: string };
    status?: { privacyStatus?: string };
  }>;

  return (vids.items ?? [])
    .filter((v) => v.id)
    .map((v) => ({
      id: v.id as string,
      title: v.snippet?.title ?? "",
      thumbnail:
        v.snippet?.thumbnails?.medium?.url ??
        v.snippet?.thumbnails?.default?.url ??
        null,
      viewCount: Number(v.statistics?.viewCount ?? 0),
      publishedAt: v.snippet?.publishedAt ?? "",
      privacyStatus: v.status?.privacyStatus ?? "public",
      url: `https://youtube.com/watch?v=${v.id}`,
    }));
}

async function getJson(
  url: string,
  headers: Record<string, string>,
  label: string,
): Promise<unknown> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`youtube_${label}_${res.status}`);
  return res.json();
}
