import { CHIP_TONES, Section } from "@/components/studio-ui";

const MAX_DOTS = 5;

/** Twelve weeks of posting as columns of dots, one per post, this week on the
 * right: gaps and streaks read at a glance without a chart. */
export default function PostingRhythm({
  weeks,
  thisWeek,
  usual,
}: {
  /** Posts per rolling week, oldest first. */
  weeks: number[];
  thisWeek: number;
  usual: number;
}) {
  return (
    <Section
      title="Posting rhythm"
      meta={`${thisWeek} this week, usually ${usual}`}
    >
      <div
        role="img"
        aria-label={`Posts per week for the last ${weeks.length} weeks: ${weeks.join(", ")}`}
        className="grid items-end gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`,
        }}
      >
        {weeks.map((count, index) => {
          return (
            <div
              key={index}
              className="flex h-[76px] flex-col-reverse items-center gap-1"
            >
              {count === 0 ? (
                <span className="bg-muted size-2.5 rounded-full" />
              ) : (
                Array.from({ length: Math.min(count, MAX_DOTS) }, (_, dot) => (
                  <span
                    key={dot}
                    className={`size-2.5 rounded-full ${CHIP_TONES.green.dot}`}
                  />
                ))
              )}
              {count > MAX_DOTS ? (
                <span className="text-muted-foreground font-mono text-[11px] leading-none">
                  +{count - MAX_DOTS}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="text-muted-foreground mt-2 flex justify-between text-xs">
        <span>{weeks.length} weeks ago</span>
        <span>This week</span>
      </div>
    </Section>
  );
}
