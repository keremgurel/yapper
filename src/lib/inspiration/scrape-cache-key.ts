/**
 * The cache key for a public post or profile URL. Share links carry tracking
 * (`?igsh=`, `?is_from_webapp=`, `utm_*`), `www.` and `m.` hosts, and trailing
 * slashes, none of which change the post, so they are dropped. YouTube's `v`
 * and `list` are kept because they ARE the content. Returns null for anything
 * that does not parse, which callers treat as "do not cache".
 */
export function scrapeCacheKey(kind: string, rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m|vm)\./, "");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const kept = ["v", "list"]
    .map((name) => [name, url.searchParams.get(name)] as const)
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  return `${kind}:${host}${path}${kept ? `?${kept}` : ""}`;
}
