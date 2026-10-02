import type { DeliveryMetrics } from "@/lib/feedback/metrics";

/** One labelled list of counted words, e.g. fillers or repeats. */
function WordList({
  label,
  hint,
  words,
}: {
  label: string;
  hint: string;
  words: { word: string; count?: number }[];
}) {
  if (words.length === 0) return null;
  return (
    <div>
      <h4 className="text-foreground text-[13px] font-semibold">{label}</h4>
      <p className="text-muted-foreground mt-0.5 text-[12px]">{hint}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {words.map(({ word, count }) => (
          <li
            key={word}
            className="bg-muted text-foreground rounded-md px-2 py-1 text-[13px]"
          >
            {word}
            {count !== undefined && (
              <span className="text-muted-foreground ml-1.5 font-mono text-[12px] tabular-nums">
                ×{count}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The words behind the delivery numbers: which fillers, which words were
 * leaned on, and which were hard to make out. Measured from the recording's
 * transcript and timings. Renders nothing when there is nothing to list.
 */
export default function DeliveryDetails({
  metrics,
}: {
  metrics: DeliveryMetrics;
}) {
  const unclear = [...new Set(metrics.lowConfidenceWords ?? [])].map(
    (word) => ({ word }),
  );
  const fillers = metrics.fillerBreakdown ?? [];
  const repeated = metrics.topRepeated ?? [];
  if (fillers.length + repeated.length + unclear.length === 0) return null;
  return (
    <div className="mt-5 grid gap-5 sm:grid-cols-3">
      <WordList
        label="Filler words"
        hint="Try a silent pause in their place."
        words={fillers}
      />
      <WordList
        label="Words you leaned on"
        hint="Used more than twice."
        words={repeated}
      />
      <WordList
        label="Hard to make out"
        hint="The transcriber was unsure of these. Say them more slowly."
        words={unclear}
      />
    </div>
  );
}
