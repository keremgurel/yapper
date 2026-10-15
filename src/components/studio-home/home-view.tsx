import { BarChart3 } from "lucide-react";
import { EmptyState } from "@/components/studio-ui";
import type { ItemSummary } from "@/lib/ideas/client";
import HomeCapture from "@/components/studio-home/home-capture";
import PostsRail from "@/components/studio-home/posts-rail";
import SetupTrack from "@/components/studio-home/setup-track";
import StatsBand from "@/components/studio-home/stats-band";
import TimeSavedCard from "@/components/studio-home/time-saved-card";
import type { TimeSaved } from "@/components/studio-home/use-time-saved";
import UpNextSection from "@/components/studio-home/up-next-section";
import type { ChannelStats } from "@/components/studio-home/channel-stats";
import type { RankedVideo } from "@/components/studio-home/rank-videos";
import type { SetupStep } from "@/components/studio-home/setup-steps";

export interface HomeChannels {
  /** Null while channel history loads. */
  ranked: RankedVideo[] | null;
  stats: ChannelStats | null;
  missing: string;
  connected?: import("@/lib/db/schema").PublishPlatform[];
  now?: number;
}

/**
 * Home's layout, render-only, at the shared Studio width. Capture across the
 * top, setup while it is unfinished, then two columns: how the channels are
 * doing on the left, what to work on next on the right. Without a connected
 * channel the queue takes the whole width. StudioDashboard decides what goes
 * in it.
 */
export default function HomeView({
  title,
  onCapture,
  setup,
  ideas,
  channels,
  timeSaved,
  userId,
}: {
  title: string;
  userId?: string;
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
  // A brand-new creator's empty queue would only repeat setup's first step.
  const queue =
    setup && ideas.items?.length === 0 ? null : (
      <UpNextSection
        items={ideas.items}
        shaping={ideas.shaping}
        failed={ideas.failed}
        onRetry={ideas.onRetry}
      />
    );
  // A creator still on setup has nothing edited to count, so the card waits
  // for their first 1-Click Edit; a read that failed with nothing to show
  // leaves it out rather than spin.
  const hideSaved =
    (setup && !timeSaved.data?.edits) || (timeSaved.failed && !timeSaved.data);
  const saved = hideSaved ? null : <TimeSavedCard saved={timeSaved.data} />;

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
              ? "Get a thought down, or pick up where you left off."
              : "Start with an idea. Type it, or press ⌘D and say it."}
        </p>
      </header>

      <HomeCapture onCapture={onCapture} />

      {setup ? <SetupTrack steps={setup} /> : null}

      {channels ? (
        <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          {channels.ranked?.length === 0 ? (
            // Connected, nothing posted yet: a row of zeros would read as
            // failure, so say where the numbers will come from.
            <div className="min-w-0 space-y-8 self-start">
              <div className="bg-card border-border rounded-xl border">
                <EmptyState
                  icon={BarChart3}
                  title="Your numbers start with your first post"
                  description={
                    channels.missing
                      ? `${channels.missing} didn’t load. Refresh to try again.`
                      : "Views and your typical post show up here once you publish."
                  }
                />
              </div>
              {saved}
            </div>
          ) : (
            <div className="min-w-0 space-y-8">
              <StatsBand stats={channels.stats} missing={channels.missing} />
              <PostsRail
                ranked={channels.ranked}
                connected={channels.connected ?? []}
                now={channels.now ?? 0}
                onCapture={onCapture}
                userId={userId}
              />
              {saved}
            </div>
          )}
          <div className="min-w-0">{queue}</div>
        </div>
      ) : (
        <>
          {queue}
          {saved}
        </>
      )}
    </div>
  );
}
