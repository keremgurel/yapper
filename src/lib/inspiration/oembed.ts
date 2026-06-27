import type { Platform, ResolvedLink } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

async function fetchOEmbed(endpoint: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(endpoint, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    return (await res.json()) as OEmbed;
  } catch {
    return null;
  }
}

function metaTag(html: string, property: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  return html.match(re)?.[1] ?? html.match(alt)?.[1];
}

async function scrapeOpenGraph(url: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const title = metaTag(html, "og:title");
    const thumbnail = metaTag(html, "og:image");
    const author = metaTag(html, "og:site_name");
    if (!title && !thumbnail) return null;
    return { title, thumbnail_url: thumbnail, author_name: author };
  } catch {
    return null;
  }
}

export async function resolveMetadata(
  platform: Platform,
  url: string,
): Promise<Partial<ResolvedLink>> {
  let data: OEmbed | null = null;

  if (platform === "youtube") {
    data = await fetchOEmbed(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
    );
  } else if (platform === "tiktok") {
    data = await fetchOEmbed(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
    );
  }

  // Instagram (and any oEmbed miss) falls back to Open Graph scraping.
  if (!data) {
    data = await scrapeOpenGraph(url);
  }

  return {
    title: data?.title,
    author: data?.author_name,
    thumbnail: data?.thumbnail_url,
  };
}
