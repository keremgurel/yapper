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
  const { connections, loading: connectionsLoading } =
    useConnections(!!isSignedIn);
  const channels = useChannelVideos(!!isSignedIn);
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
  const todaysIdeas = dailyIdeas(ideas, ranked[0]);

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
                <Plus className="h-4 w-4" /> New video
              </Link>
            </Button>
          </>
        }
      />
      <div className="space-y-8">
        <PerformanceBand
          loaded={channels !== null}
          totalViews={totalViews}
          postCount={ranked.length}
          averageViews={averageViews}
          connectedCount={connectedCount}
        />
        <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <UpNextSection items={pipeline} />
          <DailyIdeasSection ideas={todaysIdeas} />
        </div>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
          <TopContentSection ranked={channels === null ? null : ranked} />
          <ChannelsSection
            channels={channels}
            connections={connections}
            loading={connectionsLoading}
          />
        </div>
      </div>
    </div>
  );
}
