"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useConnections } from "@/hooks/use-connections";
import { useIdeaBank } from "@/hooks/use-idea-bank";
import { publishPlatforms } from "@/lib/db/schema";
import HomeView from "@/components/studio-home/home-view";
import { greeting } from "@/components/studio-home/greeting";
import { rankVideos } from "@/components/studio-home/rank-videos";
import {
  channelStats,
  weeklyPosts,
} from "@/components/studio-home/channel-stats";
import { setupSteps } from "@/components/studio-home/setup-steps";
import { isChannelConnected } from "@/components/studio-home/connection-state";
import {
  allChannelsFailed,
  failedChannels,
  joinPlatformNames,
} from "@/components/studio-home/channel-health";
import { useBrainStarted } from "@/components/studio-home/use-brain-started";
import { useChannelVideos } from "@/components/studio-home/use-channel-videos";
import { useLocalHour } from "@/components/studio-home/use-local-hour";

/**
 * Home: capture first, then what to work on, then how the posts are doing.
 *
 * It reshapes itself around where the creator is. A new account sees the
 * composer, a three-step setup and an empty queue that points back at the
 * composer. A set-up account never sees setup again; it gets its queue and
 * its numbers and posts. Channel numbers appear only once a channel is
 * connected.
 * This file only decides; HomeView draws.
 */
export default function StudioDashboard() {
  const { isSignedIn, user } = useUser();
  const hour = useLocalHour();
  const ideas = useIdeaBank();
  const { connections, error: connectionsError } = useConnections(!!isSignedIn);
  const channelResource = useChannelVideos(!!isSignedIn);
  const channels = channelResource.data;
  const brain = useBrainStarted(!!isSignedIn);

  // One clock per visit, so the numbers do not shift while the page is open.
  const [now] = useState(() => Date.now());
  // Every channel failing leaves nothing to rank; partial failures still
  // count what did load.
  const shown = useMemo(
    () =>
      channels === null
        ? null
        : allChannelsFailed(channels)
          ? []
          : rankVideos(channels),
    [channels],
  );
  const stats = useMemo(
    () => (shown === null ? null : channelStats(shown, now)),
    [shown, now],
  );
  const connectedCount = publishPlatforms.filter((platform) =>
    isChannelConnected(platform, channels, connections),
  ).length;
  const items = ideas.loading || ideas.loadFailed ? null : ideas.bank;

  // Setup only shows when every answer is known: a slow or failed read must
  // never make a set-up creator look new.
  const known =
    brain !== null &&
    items !== null &&
    (connections !== null || channels !== null) &&
    !connectionsError;
  const steps = setupSteps({
    brain: Boolean(brain),
    channel: connectedCount > 0,
    idea: Boolean(items?.length),
  });
  const showSetup = known && steps.some((step) => !step.done);
  const failed = failedChannels(channels);

  return (
    <HomeView
      title={hour === null ? "" : greeting(hour, user?.firstName)}
      onCapture={ideas.capture}
      setup={showSetup ? steps : null}
      ideas={{
        items,
        shaping: ideas.working,
        failed: ideas.loadFailed,
        onRetry: () => void ideas.refresh(),
      }}
      channels={
        connectedCount > 0
          ? {
              ranked: shown,
              stats,
              weeks: shown === null ? null : weeklyPosts(shown, now),
              missing: joinPlatformNames(failed),
            }
          : null
      }
    />
  );
}
