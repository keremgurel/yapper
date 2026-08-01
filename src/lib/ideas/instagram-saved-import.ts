import { normalizeInspoUrl } from "@/lib/inspiration/dedupe";

export interface InstagramSavedEntry {
  url: string;
  title?: string;
  collection: string;
  savedAt?: number;
  sourceFile: string;
}

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com"]);
const POST_PATH = /^\/(?:p|reel|reels|tv)\//i;

function instagramPostUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.replace(/&amp;/g, "&"));
    if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (!POST_PATH.test(url.pathname)) return null;
    url.hash = "";
    // Tracking parameters make the same saved post look different. Instagram
    // post identity lives in the path, so keep the canonical path only.
    return `${url.protocol}//www.instagram.com${url.pathname.replace(/\/+$/, "")}/`;
  } catch {
    return null;
  }
}

function humanize(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fileCollection(filename: string): string {
  const basename = filename.split("/").pop() ?? filename;
  if (/saved[_ -]?posts?/i.test(basename)) return "All saved posts";
  return humanize(basename) || "Instagram saves";
}

function numericTimestamp(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  // Meta archives normally store epoch seconds, while our models use ms.
  return value < 10_000_000_000 ? value * 1_000 : value;
}

function titleFrom(record: Record<string, unknown>): string | undefined {
  for (const key of ["title", "name", "value"]) {
    const value = record[key];
    if (typeof value === "string" && !instagramPostUrl(value)) {
      const trimmed = value.trim();
      if (trimmed && trimmed.length <= 300) return trimmed;
    }
  }
  return undefined;
}

function parseJsonFile(
  filename: string,
  value: unknown,
): InstagramSavedEntry[] {
  const entries: InstagramSavedEntry[] = [];
  const fallbackCollection = fileCollection(filename);

  const walk = (node: unknown, collection: string, path: string[]) => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child, collection, path);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    const inCollectionContext = path.some((part) => /collection/i.test(part));
    const possibleLabel = titleFrom(record);
    const nextCollection =
      inCollectionContext && possibleLabel && collection === fallbackCollection
        ? possibleLabel
        : collection;

    const stringList = record.string_list_data;
    if (Array.isArray(stringList)) {
      for (const raw of stringList) {
        if (!raw || typeof raw !== "object") continue;
        const item = raw as Record<string, unknown>;
        const url = instagramPostUrl(item.href ?? item.url ?? item.value);
        if (!url) continue;
        entries.push({
          url,
          title: possibleLabel,
          collection: nextCollection,
          savedAt: numericTimestamp(item.timestamp ?? record.timestamp),
          sourceFile: filename,
        });
      }
    }

    // Archive schemas change. Walking every field lets us tolerate renamed
    // wrapper keys while still accepting only canonical Instagram post URLs.
    for (const [key, child] of Object.entries(record)) {
      if (key === "string_list_data") continue;
      if (typeof child === "string") {
        const url = instagramPostUrl(child);
        if (url) {
          entries.push({
            url,
            title: possibleLabel,
            collection: nextCollection,
            savedAt: numericTimestamp(record.timestamp),
            sourceFile: filename,
          });
        }
      } else {
        walk(child, nextCollection, [...path, key]);
      }
    }
  };

  walk(value, fallbackCollection, []);
  return entries;
}

function parseHtmlFile(filename: string, html: string): InstagramSavedEntry[] {
  const entries: InstagramSavedEntry[] = [];
  const collection = fileCollection(filename);
  const hrefs = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of hrefs) {
    const url = instagramPostUrl(match[1]);
    if (url) entries.push({ url, collection, sourceFile: filename });
  }
  return entries;
}

/** Parse the JSON/HTML documents from an Instagram export. This intentionally
 * does not know one fixed Meta filename or wrapper shape: exports vary by
 * locale and Meta changes their schema without notice. */
export function parseInstagramSavedFiles(
  files: Record<string, string>,
): InstagramSavedEntry[] {
  const found: InstagramSavedEntry[] = [];

  for (const [filename, text] of Object.entries(files)) {
    if (/\.json$/i.test(filename)) {
      try {
        found.push(...parseJsonFile(filename, JSON.parse(text) as unknown));
      } catch {
        // An unrelated or malformed JSON file should not sink the full import.
      }
    } else if (/\.html?$/i.test(filename)) {
      found.push(...parseHtmlFile(filename, text));
    }
  }

  const unique = new Map<string, InstagramSavedEntry>();
  for (const entry of found) {
    const key = normalizeInspoUrl(entry.url);
    const current = unique.get(key);
    // Prefer a named collection over the generic all-saves bucket, while
    // retaining the newest available saved timestamp.
    if (
      !current ||
      (current.collection === "All saved posts" &&
        entry.collection !== "All saved posts")
    ) {
      unique.set(key, entry);
    } else if ((entry.savedAt ?? 0) > (current.savedAt ?? 0)) {
      unique.set(key, { ...current, savedAt: entry.savedAt });
    }
  }

  return [...unique.values()].sort(
    (a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0),
  );
}
