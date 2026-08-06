"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  BarChart3,
  Eye,
  ExternalLink,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Video,
} from "lucide-react";
import PlatformIcon from "@/components/publish/platform-icon";
import { Button } from "@/components/ui/button";
import { useConnections } from "@/hooks/use-connections";
import { listIdeas, type ItemSummary } from "@/lib/ideas/client";
import { fetchPlatformVideos, type PlatformVideo } from "@/lib/publish/client";
import { PLATFORMS } from "@/lib/publish/platforms";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

type ChannelResult = {
  platform: PublishPlatform;
  connected: boolean;
  videos: PlatformVideo[];
};

type RankedVideo = PlatformVideo & { platform: PublishPlatform };

const IDEA_STARTERS = [
  "Answer the one question your audience keeps asking incorrectly",
  "Show the fastest way to fix a common beginner mistake",
  "React to advice in your niche that sounds right but is not",
  "Turn a recent client or student win into a three-step lesson",
  "Explain what you would do differently if you started again today",
  "Compare the popular method with the method that actually works",
  "Break down one small detail experts notice immediately",
  "Give your audience a 30-second challenge they can try today",
] as const;

function compactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function ideaTitle(idea: ItemSummary): string {
  return idea.title || idea.sourceTitle || idea.originalNote || "Untitled idea";
}

function dailyIdeas(saved: ItemSummary[], topVideo?: RankedVideo): string[] {
  const savedTitles = saved.map(ideaTitle).filter(Boolean).slice(0, 5);
  const now = new Date();
  const day = Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000,
  );
  const rotated = Array.from(
    { length: IDEA_STARTERS.length },
    (_, index) => IDEA_STARTERS[(day + index) % IDEA_STARTERS.length],
  );
  const performanceIdea = topVideo?.title
    ? `Make the useful follow-up your viewers need after “${topVideo.title}”`
    : null;
  return [
    ...savedTitles,
    ...(performanceIdea ? [performanceIdea] : []),
    ...rotated,
  ]
    .filter((title, index, all) => all.indexOf(title) === index)
    .slice(0, 5);
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border-border bg-card/55 min-w-0 border-r border-b p-4 even:border-r-0 sm:p-5 lg:border-b-0 lg:last:border-r-0 lg:even:border-r [&:nth-child(n+3)]:border-b-0">
      <p className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <p className="text-foreground mt-2 text-2xl font-black tracking-tight">
        {value}
      </p>
      <p className="text-muted-foreground mt-1 truncate text-xs">{detail}</p>
    </div>
  );
}

export default function StudioDashboard() {
  const { isSignedIn } = useUser();
  const { connections, loading: connectionsLoading } =
    useConnections(!!isSignedIn);
  const [channels, setChannels] = useState<ChannelResult[] | null>(null);
  // The bank lives on the server now, so the dashboard reads it the same way
  // the Idea Bank does instead of peeking at localStorage.
  const [ideas, setIdeas] = useState<ItemSummary[]>([]);
  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    listIdeas().then(
      (rows) => {
        if (!cancelled) setIdeas(rows);
      },
      () => {
        // The dashboard degrades to its evergreen starters.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void Promise.all(
      publishPlatforms.map(async (platform) => ({
        platform,
        ...(await fetchPlatformVideos(platform)),
      })),
    ).then((results) => {
      if (!cancelled) setChannels(results);
    });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const ranked = useMemo<RankedVideo[]>(
    () =>
      (channels ?? [])
        .flatMap(({ platform, videos }) =>
          videos.map((video) => ({ ...video, platform })),
        )
        .sort((a, b) => b.viewCount - a.viewCount),
    [channels],
  );
  const totalViews = ranked.reduce((sum, video) => sum + video.viewCount, 0);
  const connectedCount = publishPlatforms.filter((platform) => {
    const channelConnected = channels?.some(
      (channel) => channel.platform === platform && channel.connected,
    );
    const accountConnected = connections?.some(
      (connection) =>
        connection.platform === platform && connection.status === "connected",
    );
    return channelConnected || accountConnected;
  }).length;
  const averageViews = ranked.length
    ? Math.round(totalViews / ranked.length)
    : 0;
  const topContent = ranked.slice(0, 3);
  const todaysIdeas = dailyIdeas(ideas, topContent[0]);

  return (
    <div className="w-full space-y-6 pb-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[11px] font-black tracking-[0.16em] text-[color:var(--sg-accent)] uppercase">
            Home
          </p>
          <h1 className="font-display text-foreground text-3xl font-black tracking-tight sm:text-4xl">
            Your content, in one view.
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm leading-6">
            Performance across every connected channel, the posts doing the most
            work, and five ideas ready for today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/studio/ideas">
              <Lightbulb className="h-4 w-4" /> Idea bank
            </Link>
          </Button>
          <Button asChild>
            <Link href="/studio/editor">
              <Plus className="h-4 w-4" /> New video
            </Link>
          </Button>
        </div>
      </header>

      <section className="border-border overflow-hidden rounded-xl border">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Total views"
            value={channels ? compactNumber(totalViews) : "—"}
            detail="Across loaded channel history"
          />
          <Metric
            label="Published posts"
            value={channels ? compactNumber(ranked.length) : "—"}
            detail="YouTube, TikTok, and Instagram"
          />
          <Metric
            label="Average views"
            value={channels ? compactNumber(averageViews) : "—"}
            detail="Per published post"
          />
          <Metric
            label="Connected"
            value={channels ? `${connectedCount} / 3` : "—"}
            detail="Active publishing channels"
          />
        </div>
      </section>

      <section className="border-border bg-card/35 rounded-xl border p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-foreground text-base font-black">
              Connected channels
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              A live roll-up of each account Yapper can read and publish to.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/studio/connections">Manage</Link>
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {publishPlatforms.map((platform) => {
            const channel = channels?.find(
              (item) => item.platform === platform,
            );
            const connection = connections?.find(
              (item) =>
                item.platform === platform && item.status === "connected",
            );
            const views = channel?.videos.reduce(
              (sum, video) => sum + video.viewCount,
              0,
            );
            const connected = Boolean(channel?.connected || connection);
            return (
              <div
                key={platform}
                className="border-border bg-background/45 rounded-lg border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="border-border bg-card grid h-10 w-10 place-items-center rounded-lg border">
                    <PlatformIcon
                      platform={platform}
                      branded
                      className="h-5 w-5"
                    />
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-[10px] font-black ${
                      connected
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {connected ? "Connected" : "Not connected"}
                  </span>
                </div>
                <p className="text-foreground mt-3 text-sm font-black">
                  {PLATFORMS[platform].label}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {connection?.handle ||
                    (connected
                      ? "Account connected"
                      : "Connect to load performance")}
                </p>
                <div className="border-border mt-4 grid grid-cols-2 border-t pt-3">
                  <div>
                    <p className="text-foreground text-sm font-black">
                      {connected ? compactNumber(views ?? 0) : "—"}
                    </p>
                    <p className="text-muted-foreground text-[10px] uppercase">
                      Views
                    </p>
                  </div>
                  <div>
                    <p className="text-foreground text-sm font-black">
                      {connected
                        ? compactNumber(channel?.videos.length ?? 0)
                        : "—"}
                    </p>
                    <p className="text-muted-foreground text-[10px] uppercase">
                      Posts
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {(channels === null || connectionsLoading) && (
          <p className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating channel
            performance…
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section className="border-border bg-card/35 rounded-xl border p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-base font-black">
                <BarChart3 className="h-4 w-4 text-[color:var(--sg-accent)]" />
                Top content
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Your three most-viewed posts across every channel.
              </p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/studio/poster">
                Open Poster <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {channels === null ? (
            <div className="text-muted-foreground flex min-h-56 items-center justify-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Ranking your posts…
            </div>
          ) : topContent.length === 0 ? (
            <div className="border-border grid min-h-56 place-items-center rounded-lg border border-dashed p-6 text-center">
              <div>
                <Video className="text-muted-foreground mx-auto h-5 w-5" />
                <p className="text-foreground mt-3 text-sm font-black">
                  No channel posts yet
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Connect a channel to see its strongest content here.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {topContent.map((video, index) => (
                <a
                  key={`${video.platform}-${video.id}`}
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border bg-background/50 group hover:border-foreground/25 overflow-hidden rounded-lg border no-underline transition"
                >
                  <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                    ) : null}
                    <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-black text-white">
                      #{index + 1}
                    </span>
                    <span className="absolute right-2 bottom-2 grid h-7 w-7 place-items-center rounded-md bg-black/70 text-white">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-foreground line-clamp-2 min-h-10 text-xs leading-5 font-black">
                      {video.title || "Untitled"}
                    </p>
                    <div className="text-muted-foreground mt-2 flex items-center justify-between gap-2 text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <PlatformIcon
                          platform={video.platform}
                          branded
                          className="h-3.5 w-3.5"
                        />
                        {PLATFORMS[video.platform].label}
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        <Eye className="h-3 w-3" />{" "}
                        {compactNumber(video.viewCount)}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="border-border bg-card/35 rounded-xl border p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-base font-black">
                <Sparkles className="h-4 w-4 text-[color:var(--sg-accent)]" />
                Five for today
              </h2>
              <p className="text-muted-foreground mt-1 text-xs">
                Start with one, then shape it in Idea Bank.
              </p>
            </div>
            <span className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
              }).format(new Date())}
            </span>
          </div>
          <ol className="space-y-2">
            {todaysIdeas.map((title, index) => (
              <li key={title}>
                <Link
                  href="/studio/ideas"
                  className="border-border hover:bg-muted/45 group flex items-start gap-3 rounded-lg border p-3 no-underline transition"
                >
                  <span className="bg-muted text-muted-foreground grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-black">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-foreground min-w-0 flex-1 text-xs leading-5 font-bold">
                    {title}
                  </span>
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground mt-0.5 h-3.5 w-3.5 shrink-0 transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link href="/studio/ideas">Open Idea Bank</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}
