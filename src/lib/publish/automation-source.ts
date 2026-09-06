import { fetchBoundedJson } from "@/lib/http/outbound";
import type { DiscoveredInstagramPost } from "@/lib/db/automations";

interface MediaPage {
  data?: {
    id?: unknown;
    media_type?: unknown;
    caption?: unknown;
    permalink?: unknown;
    timestamp?: unknown;
  }[];
  paging?: { next?: string; cursors?: { after?: string } };
}

/** Fetch only the connected account's own media. Cursors are opaque data,
 * never URLs to follow. Insight lookups are unnecessary for detecting posts. */
export async function listAutomationSourcePage(
  accessToken: string,
  cursor: string | null,
  signal: AbortSignal,
) {
  const url = new URL("https://graph.instagram.com/v21.0/me/media");
  url.searchParams.set("fields", "id,media_type,caption,permalink,timestamp");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", accessToken);
  if (cursor) url.searchParams.set("after", cursor);
  const { response, data } = await fetchBoundedJson<MediaPage>(
    url.toString(),
    { cache: "no-store" },
    {
      signal,
      timeoutMs: 20_000,
      maxBytes: 1024 * 1024,
    },
  );
  if (!response.ok)
    throw new Error(
      response.status === 400 && cursor
        ? "instagram_cursor_expired"
        : "instagram_check_failed",
    );
  if (!data || !Array.isArray(data.data))
    throw new Error("instagram_check_failed");
  const posts: DiscoveredInstagramPost[] = [];
  for (const media of data.data) {
    if (media.media_type !== "VIDEO") continue;
    if (
      typeof media.id !== "string" ||
      !/^[A-Za-z0-9_-]{1,200}$/.test(media.id) ||
      typeof media.timestamp !== "string" ||
      !Number.isFinite(Date.parse(media.timestamp))
    )
      throw new Error("instagram_check_failed");
    posts.push({
      id: media.id,
      caption: typeof media.caption === "string" ? media.caption : "",
      url: typeof media.permalink === "string" ? media.permalink : "",
      publishedAt: media.timestamp,
    });
  }
  const next = data.paging?.next ? data.paging.cursors?.after : null;
  if (
    data.paging?.next &&
    (typeof next !== "string" || !next || next.length > 4096 || next === cursor)
  )
    throw new Error("instagram_cursor_expired");
  return { posts, cursor: next ?? null };
}
