"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, RefreshCw, Trash2, TrendingUp, X } from "lucide-react";
import { PLATFORM_BY_ID } from "@/components/onboarding/platforms";
import VideoStatCard from "@/components/inspiration/video-stat-card";
import ItemNote from "@/components/inspiration/item-note";
import ClipChat from "@/components/inspiration/clip-chat";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import { videosByCreator } from "@/lib/inspiration/relations";
import type { InspirationItem, ScrapedVideo } from "@/lib/inspiration/types";
import type { ClipContext } from "@/lib/content/brainstorm";

const CLOSE_MS = 160;

function Carousel({
  title,
  videos,
  accent,
  onRemix,
}: {
  title: string;
  videos: InspirationItem["videos"];
  accent?: boolean;
  onRemix: (video: ScrapedVideo) => void;
}) {
  if (!videos || videos.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        {accent && (
          <TrendingUp className="h-4 w-4 text-[color:var(--sg-accent)]" />
        )}
        <h3 className="text-foreground text-sm font-black">{title}</h3>
        <span className="text-foreground/40 text-xs font-bold">
          {videos.length}
        </span>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {videos.map((v) => (
          <VideoStatCard key={v.url} video={v} onRemix={() => onRemix(v)} />
        ))}
      </div>
    </section>
  );
}

/** Full creator profile: identity header + their outlier videos in a carousel
 * with view/like/comment counts, then the rest of their recent feed. Scrapes on
 * open if we don't have a feed yet. Animates in/out with the t-modal transition. */
export default function CreatorProfile({
  item,
  onClose,
}: {
  item: InspirationItem;
  onClose: () => void;
}) {
  const { refreshCreator, scrapingIds, pillars, items, moveItem, deleteItem } =
    useInspiration();
  const savedClips = videosByCreator(item, items);
  const [open, setOpen] = useState(false);
  const [chatClip, setChatClip] = useState<ClipContext | null>(null);
  const requested = useRef(false);
  const scraping = scrapingIds.includes(item.id);

  const remix = (video: ScrapedVideo) =>
    setChatClip({
      title: video.title,
      platform: item.platform,
      url: video.url,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      outlierScore: video.outlierScore,
      creator: item.title,
    });

  const glyph = PLATFORM_BY_ID[item.platform];
  const initial =
    (item.handle || item.title || "?")
      .replace(/[^a-z0-9]/gi, "")
      .charAt(0)
      .toUpperCase() || "?";

  const videos = item.videos ?? [];
  const outliers = videos.filter((v) => v.isOutlier);
  const rest = videos.filter((v) => !v.isOutlier);

  // Animate in, lock scroll, wire Escape.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setOpen(true));
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scrape on first open if we've never loaded a feed.
  useEffect(() => {
    if (!requested.current && !item.videos && !scraping) {
      requested.current = true;
      void refreshCreator(item);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.videos]);

  const close = () => {
    setOpen(false);
    window.setTimeout(onClose, CLOSE_MS);
  };

  return (
    <div
      className={`t-scrim fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-md sm:items-center sm:p-4 ${open ? "is-open" : ""}`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} profile`}
    >
      <div
        className={`t-modal sg-panel flex max-h-[88svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl sm:rounded-2xl ${open ? "is-open" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-border flex items-center gap-3 border-b p-4 sm:p-5">
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full">
            {item.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-[color:var(--sg-accent)]/15 text-2xl font-black text-[color:var(--sg-accent)]">
                {initial}
              </span>
            )}
            {glyph && (
              <span className="bg-card absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full">
                <glyph.Icon className="text-foreground h-3.5 w-3.5" />
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-foreground truncate text-lg font-black">
              {item.title}
            </h2>
            <p className="text-foreground/55 truncate text-sm">
              {scraping ? (
                <span className="t-shimmer" data-text="Scanning their feed…">
                  Scanning their feed…
                </span>
              ) : videos.length > 0 ? (
                `${videos.length} recent · ${outliers.length} outlier${outliers.length === 1 ? "" : "s"}`
              ) : (
                item.author || "Creator"
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshCreator(item)}
            disabled={scraping}
            className="text-foreground/50 hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-50"
            aria-label="Refresh feed"
          >
            <RefreshCw
              className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`}
            />
          </button>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/50 hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            aria-label="Open profile"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={close}
            className="text-foreground/50 hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-5">
          {scraping && videos.length === 0 ? (
            <div className="no-scrollbar flex gap-3 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-muted aspect-[9/16] w-44 shrink-0 animate-pulse rounded-xl sm:w-48"
                />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="text-foreground/55 py-14 text-center text-sm">
              <p className="text-foreground font-bold">No feed yet</p>
              <p className="mt-1">
                We couldn&apos;t pull this creator&apos;s videos. Try refresh,
                or check the profile link.
              </p>
            </div>
          ) : (
            <>
              <Carousel
                title="Outlier videos"
                videos={outliers}
                accent
                onRemix={remix}
              />
              <Carousel title="Recent" videos={rest} onRemix={remix} />
            </>
          )}

          {/* The user's own saved clips attributed to this creator. */}
          {savedClips.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-1.5">
                <h3 className="text-foreground text-sm font-black">
                  Your saved clips
                </h3>
                <span className="text-foreground/40 text-xs font-bold">
                  {savedClips.length}
                </span>
              </div>
              <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {savedClips.map((clip) => (
                  <a
                    key={clip.id}
                    href={clip.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="t-lift border-border bg-card block w-44 shrink-0 overflow-hidden rounded-xl border shadow-sm hover:shadow-md sm:w-48"
                  >
                    <div className="bg-muted aspect-[9/16]">
                      {clip.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={clip.thumbnail}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="text-foreground/30 flex h-full w-full items-center justify-center text-xs font-bold">
                          No preview
                        </div>
                      )}
                    </div>
                    <p className="text-foreground/80 line-clamp-2 px-2.5 py-2 text-xs leading-snug">
                      {clip.title}
                    </p>
                  </a>
                ))}
              </div>
            </section>
          )}

          <ItemNote id={item.id} note={item.note} />
        </div>

        {/* Footer: sort into a pillar / remove */}
        <div className="border-border flex items-center gap-2 border-t p-3 sm:px-5">
          <select
            value={item.pillarId ?? ""}
            onChange={(e) => moveItem(item.id, e.target.value || null)}
            className="border-border bg-background text-foreground/80 min-w-0 flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm"
            aria-label="Move to pillar"
          >
            <option value="">Unsorted</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              deleteItem(item.id);
              close();
            }}
            className="text-foreground/50 hover:bg-muted flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-bold hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        </div>
      </div>

      {chatClip && (
        <ClipChat clip={chatClip} onClose={() => setChatClip(null)} />
      )}
    </div>
  );
}
