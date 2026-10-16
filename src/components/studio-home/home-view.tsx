import type { ItemSummary } from "@/lib/ideas/client";
import HomeCapture from "@/components/studio-home/home-capture";
import SetupTrack from "@/components/studio-home/setup-track";
import type { TimeSaved } from "@/components/studio-home/use-time-saved";
import AnalyticsOverview from "./analytics-overview";
import WorkSummary from "./work-summary";
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
 * top, compact 30-day analytics, then linked summaries for ideas, editing
 * time saved and calendar plans.
 */
export default function HomeView({
  title,
  now,
  onCapture,
  setup,
  ideas,
  channels,
  timeSaved,
}: {
  title: string;
  now: number;
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

  return (
    <div className="w-full min-w-0 space-y-8 pb-24">
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
        <AnalyticsOverview
          performance={performance}
          missing={channels.missing}
        />
      ) : null}
      <WorkSummary
        items={ideas.items}
        ideasFailed={ideas.failed}
        saved={timeSaved.data}
        savedFailed={timeSaved.failed}
        now={now}
      />
    </div>
  );
}
