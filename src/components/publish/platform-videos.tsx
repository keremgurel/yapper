"use client";

import { useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import {
  Check,
  Eye,
  ExternalLink,
  HardDrive,
  Loader2,
  Send,
} from "lucide-react";
import CrossPostSheet, {
  type CrossPostTarget,
} from "@/components/publish/cross-post-sheet";
import { usePlatformVideos, type VideoSort } from "@/hooks/use-platform-videos";
import { PLATFORMS } from "@/lib/publish/platforms";
import { importInstagramMedia, type PlatformVideo } from "@/lib/publish/client";
import { publishPlatforms, type PublishPlatform } from "@/lib/db/schema";

function compactViews(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

function when(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function sourceKey(platform: PublishPlatform, video: PlatformVideo): string {
  return `${platform}:${video.id}`;
}

/**
 * A source browser for every connected platform. Selection survives platform
 * switches, so creators can choose several archived originals across YouTube,
 * TikTok, and Instagram and fan them out in one publish action.
 */
export default function PlatformVideos() {
  const { isSignedIn } = useUser();
  const [platform, setPlatform] = useState<PublishPlatform>("youtube");
  const [sort, setSort] = useState<VideoSort>("recent");
  const [selected, setSelected] = useState<
    Map<string, { platform: PublishPlatform; video: PlatformVideo }>
  >(new Map());
  const [targets, setTargets] = useState<CrossPostTarget[] | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState("");
  const { videos, connected } = usePlatformVideos(platform, !!isSignedIn, sort);

  const toggle = (video: PlatformVideo) => {
    if (!video.mediaKey && !(platform === "instagram" && video.sourceFileUrl)) {
      return;
    }
    const key = sourceKey(platform, video);
    setSelected((current) => {
      const next = new Map(current);
      if (next.has(key)) next.delete(key);
      else next.set(key, { platform, video });
      return next;
    });
  };

  const prepareCrossPost = async () => {
    if (preparing || selected.size === 0) return;
    setPreparing(true);
    setPrepareError("");
    try {
      const prepared: CrossPostTarget[] = [];
      for (const { platform: sourcePlatform, video } of selected.values()) {
        let mediaKey = video.mediaKey;
        let title = video.title;
        if (
          !mediaKey &&
          sourcePlatform === "instagram" &&
          video.sourceFileUrl
        ) {
          const imported = await importInstagramMedia(video.id);
          mediaKey = imported.mediaKey;
          title = imported.title || title;
        }
        if (!mediaKey) continue;
        prepared.push({
          id: `${sourcePlatform}-${video.id}`,
          title: title || "Untitled",
          initialTitle: title || "Untitled",
          mediaKey,
        });
      }
      if (prepared.length === 0) {
        setPrepareError(
          "Those posts do not have a reusable original attached yet.",
        );
        return;
      }
      setTargets(prepared);
    } catch {
      setPrepareError(
        "One of those originals could not be prepared. Your selection is still here.",
      );
    } finally {
      setPreparing(false);
    }
  };

  return (
    <section className="border-border bg-card/35 rounded-3xl border p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black tracking-wide text-[color:var(--sg-accent)] uppercase">
            Your channels
          </p>
          <h2 className="text-foreground mt-1 text-lg font-black">
            Reuse a video you already posted
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Select archived originals across platforms, then publish the whole
            selection to several destinations at once.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void prepareCrossPost()}
          disabled={selected.size === 0 || preparing}
          className="bg-foreground text-background inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition hover:opacity-90 disabled:opacity-40"
        >
          {preparing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Cross-post {selected.size || ""} selected
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="bg-muted/50 flex rounded-xl p-1">
          {publishPlatforms.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setPlatform(candidate)}
              className={`rounded-lg px-3 py-1.5 text-xs font-black transition ${
                platform === candidate
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {PLATFORMS[candidate].label}
              {[...selected.values()].filter(
                (source) => source.platform === candidate,
              ).length > 0 && (
                <span className="ml-1.5 text-[color:var(--sg-accent)]">
                  {
                    [...selected.values()].filter(
                      (source) => source.platform === candidate,
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {(["recent", "views"] as VideoSort[]).map((candidate) => (
            <button
              key={candidate}
              type="button"
              onClick={() => setSort(candidate)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                sort === candidate
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground"
              }`}
            >
              {candidate === "recent" ? "Recent" : "Most viewed"}
            </button>
          ))}
        </div>
      </div>

      {!connected && videos !== null ? (
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed px-5 py-9 text-center text-sm">
          <p>
            Connect {PLATFORMS[platform].label} to browse videos from this
            channel.
          </p>
          <Link
            href="/studio/connections"
            className="mt-2 inline-block font-black text-[color:var(--sg-accent)]"
          >
            Open Connections
          </Link>
        </div>
      ) : videos === null ? (
        <div className="text-muted-foreground flex items-center gap-2 py-10 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {PLATFORMS[platform].label}…
        </div>
      ) : videos.length === 0 ? (
        <div className="border-border text-muted-foreground rounded-2xl border border-dashed py-10 text-center text-sm">
          No videos found. Older TikTok connections may need to reconnect once
          for video access.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {videos.map((video) => {
            const key = sourceKey(platform, video);
            const active = selected.has(key);
            const reusable =
              Boolean(video.mediaKey) ||
              (platform === "instagram" && Boolean(video.sourceFileUrl));
            return (
              <article
                key={video.id}
                className={`bg-card group relative overflow-hidden rounded-2xl border transition ${
                  active
                    ? "border-[color:var(--sg-accent)] ring-1 ring-[color:var(--sg-accent)]/30"
                    : "border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(video)}
                  disabled={!reusable}
                  className="block w-full text-left disabled:cursor-not-allowed"
                >
                  <div className="bg-muted relative aspect-[4/5] overflow-hidden">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumbnail}
                        alt=""
                        className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
                          reusable ? "" : "opacity-45 grayscale"
                        }`}
                      />
                    ) : null}
                    <span
                      className={`absolute top-2 left-2 grid h-7 w-7 place-items-center rounded-full border backdrop-blur ${
                        active
                          ? "border-[color:var(--sg-accent)] bg-[color:var(--sg-accent)] text-black"
                          : "border-white/30 bg-black/45 text-transparent"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                      <HardDrive className="h-2.5 w-2.5" />
                      {reusable ? "Original ready" : "Original unavailable"}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <p className="text-foreground line-clamp-2 min-h-8 text-xs font-black">
                      {video.title || "Untitled"}
                    </p>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-[10px]">
                      <Eye className="h-3 w-3" />
                      {compactViews(video.viewCount)}
                      {video.publishedAt ? ` · ${when(video.publishedAt)}` : ""}
                    </p>
                  </div>
                </button>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${video.title}`}
                  className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur hover:bg-black/75"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </article>
            );
          })}
        </div>
      )}

      {!prepareError && videos?.some((video) => !video.mediaKey) ? (
        <p className="text-muted-foreground mt-3 text-[11px] leading-5">
          Platforms expose post metadata, not original files. Yapper can
          instantly reuse anything it published and can import Instagram
          originals; older external YouTube and TikTok posts need their original
          uploaded once.
        </p>
      ) : null}
      {prepareError ? (
        <p className="mt-3 text-xs font-bold text-red-500">{prepareError}</p>
      ) : null}

      {targets && (
        <CrossPostSheet
          key={targets.map((target) => target.id).join(",")}
          items={targets}
          onClose={() => setTargets(null)}
        />
      )}
    </section>
  );
}
