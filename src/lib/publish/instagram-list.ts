/**
 * List the connected Instagram account's own videos and Reels, the media that
 * can be re-posted elsewhere. Instagram Login / Graph, read scope
 * `instagram_business_basic`. `sourceFileUrl` is the file Instagram serves for
 * the media, which the cross-post pipeline downloads and re-uploads to another
 * platform. Photos and carousels are dropped: there is no single video file to
 * backfill from them.
 *
 * `sourceFileUrl` is null when Graph withholds `media_url`, which it does for
 * any Reel carrying licensed audio from Instagram's music library. Those Reels
 * still belong in the list — they are the creator's most recent posts, with a
 * thumbnail, caption and permalink — they just cannot be imported, so they
 * appear the way a YouTube or TikTok post does: visible, marked as needing a
 * source file. Dropping them made freshly posted Reels look like they had
 * never been posted at all.
 */
const GRAPH = "https://graph.instagram.com/v21.0";

/** One Instagram video, shaped like the shared PlatformVideo the Poster renders
 * plus `sourceFileUrl`: the downloadable file that makes it a backfill source,
 * or null when Instagram withholds it. */
export interface InstagramVideo {
  id: string;
  title: string;
  caption: string;
  thumbnail: string | null;
  viewCount: number;
  publishedAt: string;
  privacyStatus: string;
  url: string;
  sourceFileUrl: string | null;
  /** Graph does not report a length for media, so this is always null. */
  durationSec: null;
}

/** One item from the Graph `me/media` edge, only the fields we request. */
export interface InstagramMedia {
  id?: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

/**
 * A short title from a caption: the first non-empty line, trimmed. Instagram
 * has no title field, so the caption's opening line stands in; an empty or
 * missing caption yields "" and the UI shows "Untitled". Pure, so the mapping
 * and any test agree on exactly what a row is titled.
 */
export function captionToTitle(caption: string | undefined): string {
  return (
    (caption ?? "")
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

/**
 * Map raw `me/media` items to Poster rows: keep every VIDEO media with a real
 * id, newest first, whether or not Instagram handed back a downloadable
 * `media_url`. Pure so the route and its test agree on which media are listed
 * and how each row is shaped.
 */
export function mapInstagramMedia(data: InstagramMedia[]): InstagramVideo[] {
  return data
    .filter(
      (m): m is InstagramMedia & { id: string } =>
        m.media_type === "VIDEO" && Boolean(m.id),
    )
    .map((m) => ({
      id: m.id,
      title: captionToTitle(m.caption),
      caption: m.caption ?? "",
      thumbnail: m.thumbnail_url ?? null,
      viewCount: 0,
      publishedAt: m.timestamp ?? "",
      privacyStatus: "public",
      url: m.permalink ?? "",
      sourceFileUrl: m.media_url ?? null,
      durationSec: null,
    }))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** The connected account's own videos and Reels, newest first. */
export async function listInstagramVideos(
  accessToken: string,
  max = 100,
): Promise<InstagramVideo[]> {
  const limit = Math.max(1, Math.min(100, Math.floor(max) || 100));
  const fields =
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  const media: InstagramMedia[] = [];
  const cursors = new Set<string>();
  let after: string | undefined;
  // Bound both the media scanned and the number of provider pages. Only
  // reuse the cursor, never follow a provider-supplied URL with credentials.
  for (let page = 0; page < 4 && media.length < limit; page++) {
    const params = new URLSearchParams({
      fields,
      limit: String(limit - media.length),
      access_token: accessToken,
    });
    if (after) params.set("after", after);
    const res = await fetch(`${GRAPH}/me/media?${params}`, {
      cache: "no-store",
    });
    if (!res.ok) throw await instagramError(res, "media");
    const json = (await res.json()) as {
      data?: InstagramMedia[];
      paging?: { next?: string; cursors?: { after?: string } };
    };
    media.push(...(json.data ?? []).slice(0, limit - media.length));
    after = json.paging?.cursors?.after;
    if (!json.paging?.next || !after || cursors.has(after)) break;
    cursors.add(after);
  }
  const videos = mapInstagramMedia([
    ...new Map(media.map((item) => [item.id, item])).values(),
  ]);

  // View counts are not on the media node; each needs its own insights call
  // (requires instagram_business_manage_insights). Fetch in parallel and fail
  // soft to 0 so a missing metric never blocks the list.
  const views: number[] = [];
  // Keep provider concurrency bounded instead of launching 100 insights calls.
  for (let offset = 0; offset < videos.length; offset += 5) {
    views.push(
      ...(await Promise.all(
        videos
          .slice(offset, offset + 5)
          .map((v) => fetchViewCount(accessToken, v.id)),
      )),
    );
  }
  return videos.map((v, i) => ({ ...v, viewCount: views[i] }));
}

/** The play/view count for one media, or 0 if insights are unavailable (older
 * media, missing scope, or a metric the account cannot report). */
async function fetchViewCount(
  accessToken: string,
  mediaId: string,
): Promise<number> {
  try {
    const url = `${GRAPH}/${mediaId}/insights?metric=views&access_token=${encodeURIComponent(
      accessToken,
    )}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return 0;
    const json = (await res.json()) as {
      data?: { values?: { value?: number }[] }[];
    };
    return json.data?.[0]?.values?.[0]?.value ?? 0;
  } catch {
    return 0;
  }
}

/** Instagram's error for a failed call: HTTP status, Graph error code and its
 * message. Built from the response body only, so the access token in the
 * request URL never reaches a log. */
export async function instagramError(res: Response, call: string) {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: number; error_subcode?: number; message?: string };
  } | null;
  const detail = body?.error;
  const error = new Error(
    `instagram_${call}_${res.status}${
      detail
        ? ` code ${detail.code ?? "?"}${detail.error_subcode ? `/${detail.error_subcode}` : ""}: ${detail.message ?? ""}`
        : ""
    }`,
  ) as Error & { graphCode?: number };
  error.graphCode = detail?.code;
  return error;
}
