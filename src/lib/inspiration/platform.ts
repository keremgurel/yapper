import type { Platform } from "./types";

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

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  unknown: "Link",
};
