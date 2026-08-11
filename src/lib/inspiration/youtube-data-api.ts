import { youtubeChannelRef } from "./youtube-channel-ref";
import type { CreatorScrape } from "./apify";
import type { ScrapedVideo } from "./types";

/**
 * A creator's recent YouTube feed, read from the official Data API with the
 * signed-in user's own OAuth token (scope `youtube.readonly`, which we already
 * hold for publishing).
 *
 * This replaces an Apify actor run for YouTube creators. The API answers in
 * under a second where the actor took 30 to 80, it cannot break when YouTube
 * changes its page markup, and it costs 3 quota units out of the project's
 * 10,000 per day instead of ~$0.12 of metered scraping per creator.
 *
 * Only YouTube can be served this way: the equivalent Instagram and TikTok
 * endpoints only ever describe the token holder's own account, never another
 * creator's.
 */
const API = "https://www.googleapis.com/youtube/v3";

/** GET one Data API endpoint with the user's token. */
async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`youtube_api_${res.status}`);
  return (await res.json()) as T;
}

interface ChannelListing {
  items?: {
    snippet?: { title?: string; thumbnails?: { high?: { url?: string } } };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

/** The `channels.list` filter for one ref. A `/c/` vanity URL has no direct
 * filter, so it first costs a 100-unit search to learn the channel id. */
async function channelFilter(
  ref: NonNullable<ReturnType<typeof youtubeChannelRef>>,
  token: string,
): Promise<string> {
  switch (ref.by) {
    case "id":
      return `id=${encodeURIComponent(ref.value)}`;
    case "handle":
      return `forHandle=${encodeURIComponent(ref.value)}`;
    case "username":
      return `forUsername=${encodeURIComponent(ref.value)}`;
    case "search": {
      const found = await get<{ items?: { id?: { channelId?: string } }[] }>(
        `search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(ref.value)}`,
        token,
      );
      const id = found.items?.[0]?.id?.channelId;
      if (!id) throw new Error("channel_not_found");
      return `id=${encodeURIComponent(id)}`;
    }
  }
}

/** One channels.list lookup, whichever filter the URL shape calls for. */
async function findChannel(url: string, token: string) {
  const ref = youtubeChannelRef(url);
  if (!ref) throw new Error("not_a_channel_url");

  const filter = await channelFilter(ref, token);
  const listing = await get<ChannelListing>(
    `channels?part=snippet,contentDetails&${filter}`,
    token,
  );
  const channel = listing.items?.[0];
  if (!channel) throw new Error("channel_not_found");
  return channel;
}

export async function fetchYouTubeCreator(
  url: string,
  accessToken: string,
  max = 30,
): Promise<CreatorScrape> {
  const channel = await findChannel(url, accessToken);
  const uploads = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("no_uploads_playlist");

  const page = await get<{
    items?: { contentDetails?: { videoId?: string } }[];
  }>(
    `playlistItems?part=contentDetails&maxResults=${max}&playlistId=${encodeURIComponent(uploads)}`,
    accessToken,
  );
  const ids = (page.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id));

  return {
    name: channel.snippet?.title,
    avatar: channel.snippet?.thumbnails?.high?.url,
    videos: ids.length ? await fetchVideoStats(ids, accessToken) : [],
  };
}

/** One videos.list call for the whole page: the stats the outlier ranking needs
 * are not on the playlist item, and batching keeps it at a single unit. */
async function fetchVideoStats(
  ids: string[],
  token: string,
): Promise<ScrapedVideo[]> {
  const json = await get<{
    items?: {
      id?: string;
      snippet?: {
        title?: string;
        publishedAt?: string;
        thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }[];
  }>(`videos?part=snippet,statistics&id=${ids.join(",")}`, token);
  return (json.items ?? []).map((item) => ({
    url: `https://www.youtube.com/watch?v=${item.id ?? ""}`,
    thumbnail:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url,
    title: item.snippet?.title ?? "YouTube video",
    // Statistics arrive as strings, and are simply absent when the creator
    // hides a count. Absent means unknown, which ranks the same as zero here.
    views: Number(item.statistics?.viewCount ?? 0),
    likes: Number(item.statistics?.likeCount ?? 0),
    comments: Number(item.statistics?.commentCount ?? 0),
    postedAt: item.snippet?.publishedAt,
  }));
}
