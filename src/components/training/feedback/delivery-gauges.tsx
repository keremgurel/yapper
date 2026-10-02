import type { DeliveryMetrics } from "@/lib/feedback/metrics";
import RangeGauge from "@/components/training/feedback/range-gauge";
import styles from "@/components/training/feedback/report.module.css";

// Conversational English sits around 120 to 160 words a minute. One filler a
// minute goes unnoticed and up to five is ordinary; past that listeners start
// to hear them.
const PACE = { min: 60, max: 220, target: [120, 160] as [number, number] };
const FILLERS = { min: 0, max: 15, target: [0, 5] as [number, number] };

function paceVerdict(wpm: number) {
  if (wpm < PACE.target[0])
    return "Slower than conversation. Fine for emphasis, tiring over a whole answer.";
  if (wpm > PACE.target[1])
    return "Faster than most listeners follow comfortably. Let sentences end before the next begins.";
  return "A comfortable conversational pace.";
}
function fillerVerdict(perMinute: number) {
  if (perMinute <= 1) return "Barely any. Listeners will not notice these.";
  if (perMinute <= FILLERS.target[1])
    return "Ordinary. Most speakers land here.";
  return "Enough that listeners start to hear them. Swap each for a silent beat.";
}

const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);

/** Pace and fillers as gauges against the range to aim for. */
export default function DeliveryGauges({
  metrics,
}: {
  metrics: DeliveryMetrics;
}) {
  if (!finite(metrics.wpm) && !finite(metrics.fillerPerMin)) return null;
  return (
    <div className={styles.gauges}>
      {finite(metrics.wpm) && (
        <RangeGauge
          label="Pace"
          value={Math.round(metrics.wpm)}
          unit="words a minute"
          {...PACE}
          verdict={paceVerdict(metrics.wpm)}
        />
      )}
      {finite(metrics.fillerPerMin) && (
        <RangeGauge
          label="Filler words"
          value={metrics.fillerPerMin}
          unit="a minute"
          {...FILLERS}
          verdict={fillerVerdict(metrics.fillerPerMin)}
        />
      )}
    </div>
  );
}
