import { Info, Scissors } from "lucide-react";
import { EmptyState, StatBlock } from "@/components/studio-ui";
import { formatDuration } from "@/components/studio-home/format-duration";
import type { TimeSaved } from "@/components/studio-home/use-time-saved";
import { SECONDS_PER_MANUAL_CUT } from "@/lib/studio/edit-run";

function howItsCounted(since: string | null): string {
  const base = `One watch of your footage plus about ${SECONDS_PER_MANUAL_CUT} seconds for every cut, the time it takes to make them by hand.`;
  if (!since) return base;
  const date = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(since));
  return `${base} Counted from your 1-Click Edits since ${date}.`;
}

/**
 * The hours 1-Click Edit has given back, in one Level-1 card: the time saved
 * against cutting it yourself, the footage it read, then videos edited and
 * cuts made. Null keeps the shape while it loads; nothing counted yet says
 * where the number comes from instead of showing a zero.
 */
export default function TimeSavedCard({ saved }: { saved: TimeSaved | null }) {
  const counted = saved && saved.edits > 0;
  return (
    <section
      aria-label="Time saved"
      className="bg-card border-border overflow-hidden rounded-xl border"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
        <h2 className="text-foreground text-sm font-semibold">Time saved</h2>
        <span
          title={howItsCounted(saved?.since ?? null)}
          className="text-muted-foreground"
        >
          <Info aria-hidden className="size-4" />
          <span className="sr-only">{howItsCounted(saved?.since ?? null)}</span>
        </span>
      </header>
      {saved !== null && !counted ? (
        <EmptyState
          icon={Scissors}
          title="Your time saved starts here"
          description="Run 1-Click Edit on a take and the hours it saves you add up in this card."
        />
      ) : (
        <>
          <div className="px-4 pt-2 pb-4 sm:px-5">
            {saved === null ? (
              <div
                aria-hidden
                className="bg-muted h-10 w-48 animate-pulse rounded-md"
              />
            ) : (
              <p className="font-display text-foreground text-4xl font-bold tracking-[-0.02em] tabular-nums">
                {formatDuration(saved.savedSeconds)}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-sm">
              saved vs cutting it yourself
            </p>
            {saved ? (
              <p className="text-muted-foreground mt-1 text-xs">
                {formatDuration(saved.footageSeconds)} of footage ·{" "}
                {formatDuration(saved.cutSeconds)} cut out
              </p>
            ) : null}
          </div>
          <div className="border-border/60 grid grid-cols-2 border-t">
            <div className="border-border/60 border-r">
              <StatBlock
                label="Videos edited"
                value={saved ? saved.edits.toLocaleString() : null}
                detail="With 1-Click Edit"
              />
            </div>
            <StatBlock
              label="Cuts made"
              value={saved ? saved.cutCount.toLocaleString() : null}
              detail="Pauses, retakes and filler"
            />
          </div>
        </>
      )}
    </section>
  );
}
