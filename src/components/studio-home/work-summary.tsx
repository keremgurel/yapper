import Link from "next/link";
import type { ItemSummary } from "@/lib/ideas/client";
import type { TimeSaved } from "./use-time-saved";
import { SECONDS_PER_MANUAL_CUT } from "@/lib/studio/edit-run";

export default function WorkSummary({
  items,
  ideasFailed,
  saved,
  savedFailed,
  now,
}: {
  items: ItemSummary[] | null;
  ideasFailed: boolean;
  saved: TimeSaved | null;
  savedFailed: boolean;
  now: number;
}) {
  const ideas = items?.filter((item) => item.status !== "posted");
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const planned = ideas
    ?.filter(
      (item) =>
        item.scheduledFor && Date.parse(item.scheduledFor) >= today.getTime(),
    )
    .sort((a, b) => Date.parse(a.scheduledFor!) - Date.parse(b.scheduledFor!));
  const latest = ideas
    ? [...ideas]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 2)
    : [];
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(date));
  const linkClass =
    "text-muted-foreground hover:text-foreground focus-visible:outline-ring rounded text-xs underline-offset-4 hover:underline focus-visible:outline-2";
  return (
    <div className="grid gap-7 md:grid-cols-3">
      <section
        aria-label="Your ideas"
        className="border-border min-w-0 border-t pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Ideas</h2>
          <Link href="/studio/ideas" className={linkClass}>
            See all ideas
          </Link>
        </div>
        <p className="mt-4 text-[26px] leading-none font-semibold tabular-nums">
          {ideas ? ideas.length : "—"}
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            in progress
          </span>
        </p>
        {ideasFailed ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Ideas couldn’t be loaded.
          </p>
        ) : items === null ? (
          <p className="text-muted-foreground mt-3 text-xs">Loading ideas…</p>
        ) : latest.length ? (
          <ul className="mt-3 space-y-2">
            {latest.map((item) => (
              <li
                key={item.id}
                className="text-muted-foreground truncate text-xs"
                title={item.title || item.originalNote}
              >
                {item.title || item.originalNote || "Untitled idea"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            Capture a thought above to start your next video.
          </p>
        )}
      </section>
      <section
        aria-label="Hours saved with Yapper Edit"
        className="border-border min-w-0 border-t pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Yapper Edit</h2>
          <Link href="/studio/editor" className={linkClass}>
            Open editor
          </Link>
        </div>
        <p className="mt-4 text-[26px] leading-none font-semibold tabular-nums">
          {saved
            ? (saved.savedSeconds / 3600).toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })
            : "—"}
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            hours saved
          </span>
        </p>
        <p className="text-muted-foreground mt-3 text-xs">
          {savedFailed
            ? "Edit history couldn’t be loaded."
            : saved
              ? `${saved.edits.toLocaleString()} videos edited · ${saved.cutCount.toLocaleString()} cuts made`
              : "Loading edit history…"}
        </p>
        <details className="text-muted-foreground mt-2 text-xs">
          <summary className="focus-visible:outline-ring w-fit cursor-pointer rounded underline-offset-4 hover:underline focus-visible:outline-2">
            How we estimate time saved
          </summary>
          <p className="mt-2 leading-relaxed">
            One watch of your footage plus about {SECONDS_PER_MANUAL_CUT}{" "}
            seconds per cut. Counted across your Yapper edits
            {saved?.since ? ` since ${dateLabel(saved.since)}` : ""}.
          </p>
        </details>
      </section>
      <section
        aria-label="Your calendar"
        className="border-border min-w-0 border-t pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Calendar</h2>
          <Link href="/studio/calendar" className={linkClass}>
            See calendar
          </Link>
        </div>
        <p className="mt-4 text-[26px] leading-none font-semibold tabular-nums">
          {planned ? planned.length : "—"}
          <span className="text-muted-foreground ml-2 text-xs font-normal">
            videos planned
          </span>
        </p>
        {ideasFailed ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Calendar items couldn’t be loaded.
          </p>
        ) : planned === undefined ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Loading calendar…
          </p>
        ) : planned.length ? (
          <ul className="mt-3 space-y-2">
            {planned.slice(0, 2).map((item) => (
              <li key={item.id} className="flex min-w-0 gap-3 text-xs">
                <span className="text-muted-foreground shrink-0">
                  {dateLabel(item.scheduledFor!)}
                </span>
                <span className="truncate" title={item.title}>
                  {item.title || "Untitled video"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground mt-3 text-xs">
            No upcoming plans. Give your next idea a date.
          </p>
        )}
      </section>
    </div>
  );
}
