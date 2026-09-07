import type { PublishPlatform } from "@/lib/db/schema";

/**
 * The platform's id for a post, from its public URL, when the publish flow
 * only kept the link. YouTube needs the real video id to read captions; the
 * others are scraped by URL, so any stable segment will do.
 */
export function sampleIdFromUrl(
  platform: PublishPlatform,
  url: string,
): string {
  try {
    const parsed = new URL(url);
    if (platform === "youtube") {
      const v = parsed.searchParams.get("v");
      if (v) return v;
      const match = parsed.pathname.match(/\/(?:shorts|embed|v)\/([^/?]+)/);
      if (match) return match[1];
      if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1);
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    return segments[segments.length - 1] ?? url;
  } catch {
    return url;
  }
}
