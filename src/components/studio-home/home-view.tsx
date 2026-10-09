import type { ItemSummary } from "@/lib/ideas/client";
import HomeCapture from "@/components/studio-home/home-capture";
import SetupTrack from "@/components/studio-home/setup-track";
import TopPostsRail from "@/components/studio-home/top-posts-rail";
import UpNextSection from "@/components/studio-home/up-next-section";
import type { RankedVideo } from "@/components/studio-home/rank-videos";
import type { SetupStep } from "@/components/studio-home/setup-steps";

/** Home's layout, render-only: one calm column with capture on top, setup
 * while it is unfinished, the queue, then the best posts once a channel is
 * connected. StudioDashboard decides what goes in it. */
export default function HomeView({
  title,
  onCapture,
  setup,
  ideas,
  posts,
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
  posts: { ranked: RankedVideo[] | null; missing: string } | null;
}) {
  return (
    <div className="mx-auto w-full max-w-[880px] space-y-8 pb-24">
      <header>
        <h1 className="font-display text-foreground min-h-8 text-[22px] font-bold tracking-[-0.01em]">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {ideas.items?.length
            ? "Get a thought down, or pick up where you left off."
            : "Start with an idea. Type it, or press ⌘D and say it."}
        </p>
      </header>

      <HomeCapture onCapture={onCapture} />

      {setup ? <SetupTrack steps={setup} /> : null}

      {/* A brand-new creator's empty queue would only repeat setup's first
          step, so it waits for the first idea. */}
      {setup && ideas.items?.length === 0 ? null : (
        <UpNextSection
          items={ideas.items}
          shaping={ideas.shaping}
          failed={ideas.failed}
          onRetry={ideas.onRetry}
        />
      )}

      {posts ? (
        <TopPostsRail ranked={posts.ranked} missing={posts.missing} />
      ) : null}
    </div>
  );
}
