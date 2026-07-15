import type { InspirationItem } from "./types";

/**
 * Normalize a link so trivially different spellings of the same URL match: a
 * lowercased scheme and host, no leading `www.`, no trailing slash, and no
 * `#fragment`. The path and query are kept verbatim, so two different YouTube
 * videos (which differ only in `?v=`) never collapse into one.
 */
export function normalizeInspoUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol.toLowerCase()}//${host}${path}${u.search}`;
  } catch {
    // Not a parseable URL (a raw handle, say): fall back to a trimmed compare.
    return trimmed.toLowerCase();
  }
}

/**
 * The already-saved item that points at the same link, or null. Used to keep a
 * second board card from appearing when the user saves a URL they already have.
 */
export function findDuplicateInspoItem(
  items: InspirationItem[],
  url: string,
): InspirationItem | null {
  const key = normalizeInspoUrl(url);
  return items.find((it) => normalizeInspoUrl(it.url) === key) ?? null;
}
