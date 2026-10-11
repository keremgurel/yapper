import { youtubeId } from "./platform";

/**
 * Cache keys for shared scrape results.
 *
 * A key must name exactly the content the fetcher will return, or one user
 * could store a post under another post's key. So keys come only from strict
 * post or handle ids on the platforms' own hosts, YouTube uses the same parser
 * its fetcher does, and any URL with something unexpected in it (a port,
 * credentials, a query parameter that is not known share tracking) gets no
 * key and is simply not cached.
 */

const TRACKING =
  /^(utm_\w+|igsh|igshid|is_from_webapp|sender_device|_r|_t|si|lang|feature|t)$/;

function parseStrict(rawUrl: string, hosts: string[]): URL | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!hosts.includes(url.hostname.toLowerCase())) return null;
  for (const name of url.searchParams.keys()) {
    if (name !== "v" && !TRACKING.test(name)) return null;
  }
  return url;
}

const IG_HOSTS = ["instagram.com", "www.instagram.com"];
const TT_HOSTS = ["tiktok.com", "www.tiktok.com"];
const YT_HOSTS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
];

/** Key for one public video's resolved transcript, or null. */
export function referenceCacheKey(rawUrl: string): string | null {
  const ig = parseStrict(rawUrl, IG_HOSTS);
  if (ig) {
    const m = ig.pathname.match(/^\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)\/?$/);
    return m ? `resolve:instagram:${m[1]}` : null;
  }
  const tt = parseStrict(rawUrl, TT_HOSTS);
  if (tt) {
    const m = tt.pathname.match(/^\/@[\w.]+\/video\/(\d+)\/?$/);
    return m ? `resolve:tiktok:${m[1]}` : null;
  }
  if (parseStrict(rawUrl, YT_HOSTS)) {
    const id = youtubeId(rawUrl);
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `resolve:youtube:${id}`
      : null;
  }
  return null;
}

/**
 * Key for a creator's public feed, or null. YouTube is never cached: its feed
 * is read with the requesting user's own token, which can include that user's
 * private and unlisted uploads, so it must not be shared.
 */
export function creatorCacheKey(rawUrl: string): string | null {
  const ig = parseStrict(rawUrl, IG_HOSTS);
  if (ig) {
    const m = ig.pathname.match(/^\/([A-Za-z0-9_.]+)\/?$/);
    return m ? `creator:instagram:${m[1].toLowerCase()}` : null;
  }
  const tt = parseStrict(rawUrl, TT_HOSTS);
  if (tt) {
    const m = tt.pathname.match(/^\/@([A-Za-z0-9_.]+)\/?$/);
    return m ? `creator:tiktok:${m[1].toLowerCase()}` : null;
  }
  return null;
}
