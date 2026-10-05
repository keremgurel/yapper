import type { PublishPlatform } from "@/lib/db/schema";
import type { ChannelResult } from "@/components/studio-home/use-channel-videos";

export const PLATFORM_NAMES: Record<PublishPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
};

/** The channels whose history could not be loaded just now. */
export function failedChannels(
  channels: ChannelResult[] | null,
): PublishPlatform[] {
  return (channels ?? [])
    .filter((channel) => channel.error)
    .map((channel) => channel.platform);
}

/** True when nothing could be shown: every channel that should have data
 * failed. One failing channel must not hide the others' numbers. */
export function allChannelsFailed(channels: ChannelResult[] | null): boolean {
  const relevant = (channels ?? []).filter(
    (channel) => channel.connected || channel.error,
  );
  return relevant.length > 0 && relevant.every((channel) => channel.error);
}

/** "Instagram", "Instagram and TikTok", "Instagram, TikTok and YouTube". */
export function joinPlatformNames(platforms: PublishPlatform[]): string {
  const names = platforms.map((platform) => PLATFORM_NAMES[platform]);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
