"use client";

import { useState } from "react";
import type { PublishPlatform } from "@/lib/db/schema";
import { PLATFORMS } from "@/lib/publish/platforms";
import { CHART_COLORS } from "./chart-colors";
import { compactNumber } from "./format-number";
import type { RecentPerformance } from "./recent-performance";

/** Current views grouped by a unique video's publish date, never daily views
 * earned. Exact values and titles are available by pointer, touch or keyboard. */
export default function ViewsChart({
  performance,
}: {
  performance: RecentPerformance | null;
}) {
  const [platform, setPlatform] = useState<PublishPlatform | "all">("all");
  const [active, setActive] = useState<number | null>(null);
  const groups = performance?.groups ?? [];
  const platforms =
    performance?.channels.map((channel) => channel.platform) ?? [];
  const selected =
    platform === "all" || platforms.includes(platform) ? platform : "all";
  const days = (performance?.days ?? []).map((day) => ({
    ...day,
    groups: day.groups.filter(
      (group) =>
        selected === "all" ||
        group.posts.some((post) => post.platform === selected),
    ),
  }));
  const totals = days.map((day) =>
    day.groups.reduce(
      (sum, group) =>
        sum +
        group.posts.reduce(
          (value, post) =>
            value +
            (selected === "all" || post.platform === selected
              ? post.viewCount
              : 0),
          0,
        ),
      0,
    ),
  );
  const maximum = Math.max(1, ...totals);
  const step = 10 ** Math.floor(Math.log10(maximum)) / 2;
  const ceiling = Math.ceil(maximum / (2 * step)) * 2 * step;
  const selectedDay =
    active === null ? null : days[Math.min(active, days.length - 1)];
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  const viewTotal = totals.reduce((sum, value) => sum + value, 0);
  const title = selectedDay
    ? `${dateLabel(selectedDay.date)} · ${selectedDay.groups.length} ${selectedDay.groups.length === 1 ? "video" : "videos"}`
    : "Views by publish date";
  return (
    <section
      className="min-w-0"
      aria-label="Current views by video publish date"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div
          role="group"
          aria-label="Chart platform"
          className="flex flex-wrap gap-1"
        >
          {(["all", ...platforms] as const).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={selected === key}
              onClick={() => {
                setPlatform(key);
                setActive(null);
              }}
              className={`focus-visible:outline-ring flex min-h-9 items-center gap-1.5 rounded-md px-2.5 text-xs focus-visible:outline-2 ${selected === key ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}
            >
              {key !== "all" ? (
                <span
                  className="size-1.5 rounded-full"
                  style={{ background: CHART_COLORS[key] }}
                  aria-hidden="true"
                />
              ) : null}
              {key === "all" ? "All platforms" : PLATFORMS[key].label}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          {selected !== "all" ? `${compactNumber(viewTotal)} views · ` : ""}
          Published in the last 30 days
        </p>
      </div>
      {performance === null ? (
        <div className="bg-muted h-40 rounded-md" role="status">
          <span className="sr-only">Loading video views…</span>
        </div>
      ) : !groups.length ? (
        <div className="flex h-40 flex-col justify-center gap-2">
          <p className="text-sm font-medium">
            Your next video starts the chart
          </p>
          <p className="text-muted-foreground text-xs">
            No videos were found in the last 30 days.
          </p>
        </div>
      ) : (
        <>
          <div
            className="relative h-40 pr-10"
            onPointerLeave={() => setActive(null)}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-10 left-0 flex flex-col justify-between"
            >
              {[2, 1, 0].map((tick) => (
                <div
                  key={tick}
                  className="border-border/70 border-t border-dashed"
                />
              ))}
            </div>
            <div
              aria-hidden="true"
              className="text-muted-foreground absolute inset-y-0 right-0 flex flex-col justify-between text-[11px] tabular-nums"
            >
              {[2, 1, 0].map((tick) => (
                <span key={tick}>{compactNumber((ceiling * tick) / 2)}</span>
              ))}
            </div>
            <div
              role="group"
              tabIndex={0}
              aria-label="Video views chart. Use arrow keys to inspect publish dates and Escape to reset."
              className="focus-visible:outline-ring relative flex h-full items-end gap-[3px] rounded-sm focus-visible:outline-2"
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  setActive(
                    Math.max(
                      0,
                      Math.min(
                        days.length - 1,
                        (active ??
                          (event.key === "ArrowRight" ? -1 : days.length)) +
                          (event.key === "ArrowRight" ? 1 : -1),
                      ),
                    ),
                  );
                }
                if (event.key === "Escape") setActive(null);
              }}
            >
              {days.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  tabIndex={-1}
                  aria-label={`${dateLabel(day.date)}: ${totals[index].toLocaleString()} views across ${day.groups.length} ${day.groups.length === 1 ? "unique video" : "unique videos"}`}
                  onFocus={() => setActive(index)}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => setActive(index)}
                  className={`relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t-sm ${active === index ? "bg-muted" : ""}`}
                >
                  <span
                    className="flex w-full max-w-8 flex-col-reverse overflow-hidden rounded-t-sm"
                    style={{ height: `${(totals[index] / ceiling) * 100}%` }}
                  >
                    {platforms
                      .filter((key) => selected === "all" || key === selected)
                      .map((key) => {
                        const value = day.groups.reduce(
                          (sum, group) =>
                            sum +
                            group.posts
                              .filter((post) => post.platform === key)
                              .reduce((n, post) => n + post.viewCount, 0),
                          0,
                        );
                        return (
                          <span
                            key={key}
                            style={{
                              height: `${totals[index] ? (value / totals[index]) * 100 : 0}%`,
                              background: CHART_COLORS[key],
                            }}
                          />
                        );
                      })}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div
            aria-hidden="true"
            className="text-muted-foreground mt-2 flex justify-between pr-10 text-[11px]"
          >
            {[0, Math.floor(days.length / 2), days.length - 1].map((index) => (
              <span key={index}>{dateLabel(days[index].date)}</span>
            ))}
          </div>
          <div aria-live="polite" className="mt-3 min-h-10 text-xs">
            <p className="text-foreground font-medium">
              {title}
              {selectedDay && active !== null
                ? ` · ${totals[Math.min(active, days.length - 1)].toLocaleString()} views`
                : ""}
            </p>
            <p
              className="text-muted-foreground mt-1 truncate"
              title={selectedDay?.groups
                .map(
                  (group) =>
                    group.primary.title || group.primary.caption || "Untitled",
                )
                .join(" · ")}
            >
              {selectedDay
                ? selectedDay.groups
                    .map(
                      (group) =>
                        group.primary.title ||
                        group.primary.caption ||
                        "Untitled",
                    )
                    .join(" · ") || "No videos posted on this date"
                : "Current view counts, with cross-posts combined into one video."}
            </p>
          </div>
        </>
      )}
    </section>
  );
}
