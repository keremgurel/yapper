/**
 * List the connected channel's own uploads with view counts, for the content
 * hub. Up to nine calls for 200 uploads: one uploads playlist lookup, four
 * item pages and four snippet/statistics batches. Read-only (`youtube.readonly`).
 */
export interface YouTubeVideo {
  id: string;
  title: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  privacyStatus: string;
  url: string;
  /** Length in seconds when the platform reports one. */
  durationSec: number | null;
}

/** ISO 8601 durations as YouTube writes them: PT1H2M3S. */
export function parseIsoDuration(value: string | undefined): number | null {
  const match = value?.match(
    /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );
  if (!match) return null;
  const [, d, h, m, sec] = match.map((part) => Number(part ?? 0));
  const total = d * 86_400 + h * 3_600 + m * 60 + sec;
  return Number.isFinite(total) ? total : null;
}

interface JsonList<T> {
  items?: T[];
  nextPageToken?: string;
}

export async function listYouTubeVideos(
  accessToken: string,
  max = 200,
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

  const limit = Math.max(1, Math.min(200, Math.floor(max) || 200));
  const ids: string[] = [];
  let pageToken: string | undefined;
  const seenTokens = new Set<string>();
  for (let page = 0; page < Math.ceil(limit / 50); page++) {
    const params = new URLSearchParams({
      part: "contentDetails",
      maxResults: String(Math.min(50, limit - ids.length)),
      playlistId: uploads,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const pl = (await getJson(
      `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
      headers,
      "playlist",
    )) as JsonList<{ contentDetails?: { videoId?: string } }>;
    ids.push(
      ...(pl.items ?? []).flatMap((item) =>
        item.contentDetails?.videoId ? [item.contentDetails.videoId] : [],
      ),
    );
    pageToken = pl.nextPageToken;
    if (!pageToken || seenTokens.has(pageToken) || ids.length >= limit) break;
    seenTokens.add(pageToken);
  }
  if (ids.length === 0) return [];

  const uniqueIds = [...new Set(ids)].slice(0, limit);
  const batches = await Promise.all(
    Array.from(
      { length: Math.ceil(uniqueIds.length / 50) },
      async (_, index) => {
        const vids = (await getJson(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,status,contentDetails&id=${uniqueIds.slice(index * 50, (index + 1) * 50).join(",")}`,
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
          contentDetails?: { duration?: string };
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
            durationSec: parseIsoDuration(v.contentDetails?.duration),
          }));
      },
    ),
  );
  return batches.flat();
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
