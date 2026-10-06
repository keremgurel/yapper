import Link from "next/link";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { Chip, Section } from "@/components/studio-ui";
import { PLATFORMS } from "@/lib/publish/platforms";
import { publishPlatforms } from "@/lib/db/schema";
import type { ConnectionSummary } from "@/lib/publish/client";
import { compactNumber } from "@/components/studio-home/format-number";
import { isChannelConnected } from "@/components/studio-home/connection-state";
import type { ChannelResult } from "@/components/studio-home/use-channel-videos";

/** One row per publishing platform: identity, per-channel numbers, and a
 * connection chip. Per-channel views live here and only here; the stat band
 * owns the totals. */
export default function ChannelsSection({
  channels,
  connections,
  loading,
  unavailable = false,
}: {
  channels: ChannelResult[] | null;
  connections: ConnectionSummary[] | null;
  loading: boolean;
  unavailable?: boolean;
}) {
  const pending = channels === null || loading;

  return (
    <Section
      title="Channels"
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/studio/connections">Manage</Link>
        </Button>
      }
    >
      <div className="bg-card border-border rounded-xl border">
        <ul className="divide-border/60 divide-y">
          {publishPlatforms.map((platform) => {
            const channel = channels?.find(
              (item) => item.platform === platform,
            );
            const connection = connections?.find(
              (item) => item.platform === platform && item.status === "active",
            );
            const connected = isChannelConnected(
              platform,
              channels,
              connections,
            );
            const views =
              channel?.videos.reduce(
                (sum, video) => sum + video.viewCount,
                0,
              ) ?? 0;
            return (
              <li
                key={platform}
                className="grid min-h-14 grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3"
              >
                <span className="bg-muted grid h-9 w-9 shrink-0 place-items-center rounded-lg">
                  <PlatformIcon
                    platform={platform}
                    branded
                    className="h-4 w-4"
                  />
                </span>
                <span className="col-span-2 min-w-0">
                  <span className="text-foreground block text-sm font-medium">
                    {PLATFORMS[platform].label}
                  </span>
                  <span className="text-muted-foreground block text-xs [overflow-wrap:anywhere]">
                    {connection?.handle ||
                      (connected
                        ? "Account connected"
                        : "Connect to load performance")}
                  </span>
                </span>
                {pending ? (
                  <span
                    aria-hidden
                    className="bg-muted col-start-2 h-4 w-24 animate-pulse rounded"
                  />
                ) : unavailable || channel?.error ? (
                  <Chip
                    tone="neutral"
                    pill
                    className="col-start-2 justify-self-start"
                  >
                    Couldn’t load
                  </Chip>
                ) : (
                  <>
                    {connected && (
                      <span className="text-muted-foreground col-start-2 row-start-2 text-xs">
                        <span className="text-foreground font-mono text-[13px] tabular-nums">
                          {compactNumber(views)}
                        </span>{" "}
                        views
                        <span aria-hidden className="mx-1.5">
                          ·
                        </span>
                        <span className="text-foreground font-mono text-[13px] tabular-nums">
                          {compactNumber(channel?.videos.length ?? 0)}
                        </span>{" "}
                        posts
                      </span>
                    )}
                    <Chip
                      tone={connected ? "green" : "neutral"}
                      pill
                      className="col-start-3 row-start-2"
                    >
                      {connected ? "Connected" : "Not connected"}
                    </Chip>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
