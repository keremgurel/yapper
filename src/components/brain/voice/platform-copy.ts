import type { PublishPlatform } from "@/lib/db/schema";
import { sampleCredits } from "@/lib/voice/units";

export const PLATFORM_LABEL: Record<PublishPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "";
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** What one video will cost, as a short label. */
export function costLabel(
  platform: PublishPlatform,
  durationSec: number | null | undefined,
): string {
  const credits = sampleCredits(platform, durationSec ?? null);
  if (credits === 0) return "Free, from captions";
  if (durationSec === null || durationSec === undefined) {
    return "1 credit per 3 min";
  }
  return credits === 1 ? "1 credit" : `${credits} credits`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
