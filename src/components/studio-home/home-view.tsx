import type { ItemSummary } from "@/lib/ideas/client";
import HomeCapture from "@/components/studio-home/home-capture";
import PostsRail from "@/components/studio-home/posts-rail";
import SetupTrack from "@/components/studio-home/setup-track";
import StatsBand from "@/components/studio-home/stats-band";
import TimeSavedCard from "@/components/studio-home/time-saved-card";
import type { TimeSaved } from "@/components/studio-home/use-time-saved";
import QuickTools from "./quick-tools";
import ChannelComparison from "./channel-comparison";
import { recentPerformance } from "./recent-performance";
import type { RankedVideo } from "@/components/studio-home/rank-videos";
import type { SetupStep } from "@/components/studio-home/setup-steps";

export interface HomeChannels {
  /** Null while channel history loads. */
  ranked: RankedVideo[] | null;
  missing: string;
  connected: import("@/lib/db/schema").PublishPlatform[];
  now: number;
}

/**
 * Home's layout, render-only, at the shared Studio width. Capture across the
 * top, a 30-day performance band, a unique-video chart beside channel
 * comparisons, then compact navigation to the creation tools.
 */
export default function HomeView({
  title,
  onCapture,
  setup,
  ideas,
  channels,
  timeSaved,
}: {
  title: string;
  onCapture: (text: string) => Promise<void>;
  /** Null once setup is done or while it is unknown. */
  setup: SetupStep[] | null;
  ideas: {
    items: ItemSummary[] | null;
    shaping: Set<string>;
    failed: boolean;
    onRetry: () => void;
  };
  /** Null until a channel is connected. */
  channels: HomeChannels | null;
  /** `data` is null while it loads. */
  timeSaved: { data: TimeSaved | null; failed: boolean };
}) {
  const performance = channels?.ranked
    ? recentPerformance(channels.ranked, channels.connected, channels.now)
    : null;
  const saved =
    timeSaved.data && timeSaved.data.edits > 0 ? (
      <TimeSavedCard saved={timeSaved.data} />
    ) : null;

  return (
    <div className="w-full space-y-8 pb-24">
      <header>
        <h1 className="font-display text-foreground min-h-8 text-[22px] font-bold tracking-[-0.01em]">
          {title}
        </h1>
        {/* Blank while ideas load, so a returning creator is not greeted
            as new for a moment. */}
        <p className="text-muted-foreground mt-1 min-h-5 text-sm">
          {ideas.items === null
            ? null
            : ideas.items.length
              ? "Get a thought down, or see how your latest videos are doing."
              : "Start with an idea. Type it, or press ⌘D and say it."}
        </p>
      </header>

      <HomeCapture onCapture={onCapture} />

      {setup ? <SetupTrack steps={setup} /> : null}

      {channels ? (
        <>
          <StatsBand stats={performance} missing={channels.missing} />
          <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div className="min-w-0">
              <PostsRail performance={performance} />
            </div>
            <div className="min-w-0">
              <ChannelComparison performance={performance} />
            </div>
          </div>
        </>
      ) : null}
      <QuickTools
        ideaCount={
          ideas.items?.filter((item) => item.status !== "posted").length ?? null
        }
      />
      {saved}
    </div>
  );
}
