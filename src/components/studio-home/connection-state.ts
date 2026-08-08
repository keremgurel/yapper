import type { PublishPlatform } from "@/lib/db/schema";
import type { ConnectionSummary } from "@/lib/publish/client";
import type { ChannelResult } from "@/components/studio-home/use-channel-videos";

/** A platform counts as connected if either source says so: the videos
 * endpoint (the token worked just now) or the stored connection row (OAuth is
 * done but channel history is still loading). */
export function isChannelConnected(
  platform: PublishPlatform,
  channels: ChannelResult[] | null,
  connections: ConnectionSummary[] | null,
): boolean {
  return Boolean(
    channels?.some(
      (channel) => channel.platform === platform && channel.connected,
    ) ||
    connections?.some(
      (connection) =>
        connection.platform === platform && connection.status === "connected",
    ),
  );
}
