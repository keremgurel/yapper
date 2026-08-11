/**
 * How to name one YouTube channel to the Data API. A channel URL comes in
 * several shapes and each maps to a different `channels.list` filter, so the
 * parsing lives here, pure, rather than inside the fetching code.
 */
export type YouTubeChannelRef =
  | { by: "id"; value: string }
  | { by: "handle"; value: string }
  | { by: "username"; value: string }
  | { by: "search"; value: string };

/**
 * The Data API filter for a channel URL, or null when the URL names no channel.
 *
 * `/channel/UC...`, `/@handle` and the legacy `/user/name` each have a direct,
 * one-unit filter. The legacy `/c/CustomName` vanity path has none, so it falls
 * back to search, which the caller pays 100 quota units for.
 */
export function youtubeChannelRef(rawUrl: string): YouTubeChannelRef | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  // Feed tabs (/videos, /shorts, /streams) hang off the channel path itself.
  const first = segments[0];
  if (!first) return null;

  if (first.startsWith("@")) {
    return { by: "handle", value: first };
  }
  if (first === "channel" && segments[1]) {
    return { by: "id", value: segments[1] };
  }
  if (first === "user" && segments[1]) {
    return { by: "username", value: segments[1] };
  }
  if (first === "c" && segments[1]) {
    return { by: "search", value: decodeURIComponent(segments[1]) };
  }
  return null;
}
