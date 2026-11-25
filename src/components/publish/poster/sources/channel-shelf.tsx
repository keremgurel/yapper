"use client";

import { Button } from "@/components/ui/button";
import PlatformIcon from "@/components/publish/platform-icon";
import { usePlatformVideos } from "@/hooks/use-platform-videos";
import type { PublishPlatform } from "@/lib/db/schema";
import { beginConnect } from "@/lib/publish/begin-connect";
import { PLATFORMS } from "@/lib/publish/platforms";
import { fromPlatform, type PosterVideo } from "../poster-video";
import ShelfNotice from "./shelf-notice";
import ShelfRail from "./shelf-rail";
import ShelfSkeleton from "./shelf-skeleton";
import SourceShelf from "./source-shelf";

const RECONNECT = new Set([
  "reconnect",
  "token_refresh_failed",
  "list_failed_or_reconnect_required",
]);

/**
 * A connected channel's recent posts, from the same cached list the rest of
 * Studio reads. Only a connected channel is asked for its videos, and the
 * shelf never polls on a timer, so showing three channels at once costs no
 * more provider calls than opening them one by one.
 */
export default function ChannelShelf({
  platform,
  connected,
  connectionsLoaded,
  onOpen,
}: {
  platform: PublishPlatform;
  connected: boolean;
  connectionsLoaded: boolean;
  onOpen: (video: PosterVideo) => void;
}) {
  const label = PLATFORMS[platform].label;
  const channel = usePlatformVideos(platform, connected, "recent", {
    poll: false,
  });
  const connect = (text: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => beginConnect(platform, "poster-source")}
    >
      {text}
    </Button>
  );

  let body;
  if (!connectionsLoaded) {
    body = <ShelfSkeleton label={`Loading ${label} posts`} />;
  } else if (!connected) {
    body = (
      <ShelfNotice action={connect(`Connect ${label}`)}>
        Connect {label} to pick from your recent posts.
      </ShelfNotice>
    );
  } else if (channel.error && RECONNECT.has(channel.error.message)) {
    body = (
      <ShelfNotice alert action={connect(`Reconnect ${label}`)}>
        {label} needs to be reconnected before its posts can load.
      </ShelfNotice>
    );
  } else if (channel.error) {
    body = (
      <ShelfNotice
        alert
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void channel.refresh()}
          >
            Try again
          </Button>
        }
      >
        Your {label} posts couldn’t be loaded.
      </ShelfNotice>
    );
  } else if (channel.videos === null) {
    body = <ShelfSkeleton label={`Loading ${label} posts`} />;
  } else if (!channel.connected) {
    body = (
      <ShelfNotice action={connect(`Connect ${label}`)}>
        Connect {label} to pick from your recent posts.
      </ShelfNotice>
    );
  } else if (channel.videos.length === 0) {
    body = (
      <ShelfNotice>
        Nothing posted on {label} yet. New posts show up here.
      </ShelfNotice>
    );
  } else {
    body = (
      <ShelfRail
        label={`Recent ${label} posts`}
        videos={channel.videos.map((video) => fromPlatform(platform, video))}
        onOpen={onOpen}
      />
    );
  }

  return (
    <SourceShelf
      id={platform}
      title={label}
      icon={<PlatformIcon platform={platform} className="size-4" />}
    >
      {body}
    </SourceShelf>
  );
}
