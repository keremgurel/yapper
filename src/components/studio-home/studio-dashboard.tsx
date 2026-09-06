"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio-ui";
import { useConnections } from "@/hooks/use-connections";
import { publishPlatforms } from "@/lib/db/schema";
import ChannelsSection from "@/components/studio-home/channels-section";
import DailyIdeasSection from "@/components/studio-home/daily-ideas-section";
import PerformanceBand from "@/components/studio-home/performance-band";
import TopContentSection from "@/components/studio-home/top-content-section";
import UpNextSection from "@/components/studio-home/up-next-section";
import { dailyIdeas } from "@/components/studio-home/daily-ideas";
import { rankVideos } from "@/components/studio-home/rank-videos";
import { isChannelConnected } from "@/components/studio-home/connection-state";
import { useBankIdeas } from "@/components/studio-home/use-bank-ideas";
import { useChannelVideos } from "@/components/studio-home/use-channel-videos";
import { usePipelineItems } from "@/components/studio-home/use-pipeline-items";

/** Composition root for Home. Data comes from three one-concern hooks; every
 * section is render-only, so this file only wires them together. */
export default function StudioDashboard() {
  const { isSignedIn } = useUser();
  const {
    connections,
    loading: connectionsLoading,
    error: connectionsError,
    refresh: refreshConnections,
  } = useConnections(!!isSignedIn);
  const channelResource = useChannelVideos(!!isSignedIn);
  const channels = channelResource.data;
  const pipeline = usePipelineItems(!!isSignedIn);
  const ideas = useBankIdeas(!!isSignedIn);

  const ranked = useMemo(() => rankVideos(channels), [channels]);
  const totalViews = ranked.reduce((sum, video) => sum + video.viewCount, 0);
  const averageViews = ranked.length
    ? Math.round(totalViews / ranked.length)
    : 0;
  const connectedCount = publishPlatforms.filter((platform) =>
    isChannelConnected(platform, channels, connections),
  ).length;
  const todaysIdeas = dailyIdeas(ideas.data ?? [], ranked[0]);
  const channelError = Boolean(channels?.some((channel) => channel.error));
  const pipelineError = pipeline.data === null && Boolean(pipeline.error);
  const ideasError = ideas.data === null && Boolean(ideas.error);
  const refresh = () => {
    void Promise.allSettled([
      channelResource.refresh(),
      pipeline.refresh(),
      ideas.refresh(),
      refreshConnections(),
    ]);
  };

  return (
    <div className="w-full pb-8">
      <PageHeader
        title="Home"
        description="What's in the pipeline, what to make next, and how your channels are doing."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/studio/ideas">
                <Lightbulb className="h-4 w-4" /> Idea Bank
              </Link>
            </Button>
            <Button asChild>
              <Link href="/studio/editor">
                <Plus className="h-4 w-4" /> Open editor
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-8">
        {(channelError || pipelineError || ideasError || connectionsError) && (
          <div
            role="alert"
            className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm"
          >
            <p>
              Some Studio data couldn’t be loaded. Refresh to check your
              channels, Library, and ideas again.
            </p>
            <Button size="sm" variant="outline" onClick={refresh}>
              Refresh
            </Button>
          </div>
        )}
        <PerformanceBand
          unavailable={channelError || Boolean(connectionsError)}
          loaded={channels !== null}
          totalViews={totalViews}
          postCount={ranked.length}
          averageViews={averageViews}
          connectedCount={connectedCount}
        />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          {pipelineError ? (
            <p className="text-muted-foreground text-sm">
              Your Library queue couldn’t be loaded. Use Refresh above to try
              again.
            </p>
          ) : (
            <UpNextSection items={pipeline.data} />
          )}
          <DailyIdeasSection ideas={todaysIdeas} />
        </div>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          {channelError && !ranked.length ? (
            <p className="text-muted-foreground text-sm">
              Channel performance is unavailable. Use Refresh above to try
              again.
            </p>
          ) : (
            <TopContentSection ranked={channels === null ? null : ranked} />
          )}
          <ChannelsSection
            channels={channels}
            connections={connections}
            loading={connectionsLoading}
            unavailable={Boolean(connectionsError)}
          />
        </div>
      </div>
    </div>
  );
}
