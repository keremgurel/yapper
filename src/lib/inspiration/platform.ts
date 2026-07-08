import type { InspirationKind, Platform } from "./types";

export function detectPlatform(rawUrl: string): Platform {
  try {
    const host = new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
    if (host.endsWith("tiktok.com")) return "tiktok";
    if (host.endsWith("instagram.com")) return "instagram";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export function youtubeId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (u.pathname.startsWith("/shorts/")) {
      return u.pathname.split("/")[2] ?? null;
    }
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

export function isLikelyUrl(value: string): boolean {
  return /^https?:\/\/\S+\.\S+/.test(value.trim());
}

/** Is this URL a specific piece of content (video) or a whole creator profile?
 * We lead with "creator" only when the path clearly points at a profile;
 * anything ambiguous or content-shaped defaults to "video". */
export function detectKind(rawUrl: string): InspirationKind {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return "video";
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const segments = path.split("/").filter(Boolean);

  if (host === "youtu.be") return "video";
  if (host.endsWith("youtube.com")) {
    if (u.searchParams.get("v") || segments[0] === "shorts") return "video";
    if (segments[0]?.startsWith("@")) return "creator";
    if (["channel", "c", "user"].includes(segments[0] ?? "")) return "creator";
    return "video";
  }
  if (host.endsWith("tiktok.com")) {
    // /@handle/video/123 is a clip; /@handle on its own is the creator.
    if (segments.includes("video")) return "video";
    if (segments[0]?.startsWith("@") && segments.length === 1) return "creator";
    return "video";
  }
  if (host.endsWith("instagram.com")) {
    if (["p", "reel", "reels", "tv"].includes(segments[0] ?? ""))
      return "video";
    // A bare /handle path is the profile.
    if (segments.length === 1) return "creator";
    return "video";
  }
  return "video";
}

/** Pull a creator's @handle out of a profile URL (no leading @). Returns null
 * when the URL doesn't carry a recognizable handle. */
export function extractHandle(rawUrl: string): string | null {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  const segments = u.pathname.split("/").filter(Boolean);
  const first = segments[0] ?? "";

  if (host.endsWith("youtube.com")) {
    if (first.startsWith("@")) return first.slice(1);
    if (["channel", "c", "user"].includes(first)) return segments[1] ?? null;
    return null;
  }
  if (host.endsWith("tiktok.com") || host.endsWith("instagram.com")) {
    return first.replace(/^@/, "") || null;
  }
  return null;
}

/** Loose key for matching a saved video's author to a saved creator. */
export function normalizeHandle(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  unknown: "Link",
};
