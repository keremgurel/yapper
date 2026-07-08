"use client";

import { Loader2, TrendingUp } from "lucide-react";
import { PLATFORM_BY_ID } from "@/components/onboarding/platforms";
import { useInspiration } from "@/components/inspiration/inspiration-context";
import type { InspirationItem } from "@/lib/inspiration/types";

/** A chic creator pill: avatar (or accent initial) + name + platform glyph, with
 * a small "N outliers" hint once scraped. Tapping opens their profile. Lifts on
 * hover (t-lift). */
export default function CreatorBadge({
  item,
  onOpen,
}: {
  item: InspirationItem;
  onOpen: () => void;
}) {
  const { scrapingIds } = useInspiration();
  const scraping = scrapingIds.includes(item.id);
  const glyph = PLATFORM_BY_ID[item.platform];
  const initial =
    (item.handle || item.title || "?")
      .replace(/[^a-z0-9]/gi, "")
      .charAt(0)
      .toUpperCase() || "?";
  const outliers = item.videos?.filter((v) => v.isOutlier).length ?? 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="t-lift border-border bg-card flex items-center gap-3 rounded-full border py-1.5 pr-4 pl-1.5 text-left shadow-sm hover:border-[color:var(--sg-accent)]/50"
    >
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-[color:var(--sg-accent)]/15 text-base font-black text-[color:var(--sg-accent)]">
            {initial}
          </span>
        )}
        {glyph && (
          <span className="bg-card absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full">
            <glyph.Icon className="text-foreground h-3 w-3" />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="text-foreground block truncate text-sm font-bold">
          {item.title}
        </span>
        <span className="text-foreground/55 flex items-center gap-1 text-xs">
          {scraping ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Scanning feed…
            </>
          ) : outliers > 0 ? (
            <>
              <TrendingUp className="h-3 w-3 text-[color:var(--sg-accent)]" />
              {outliers} outlier{outliers === 1 ? "" : "s"}
            </>
          ) : item.videos ? (
            `${item.videos.length} videos`
          ) : (
            "Tap to load feed"
          )}
        </span>
      </span>
    </button>
  );
}
