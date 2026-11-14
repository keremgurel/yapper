import styles from "./studio-bento.module.css";

/** The kept stretches of the example take, as percentages of its length. */
const kept = [
  [4, 6],
  [27, 30],
  [33, 35],
  [43, 46],
  [58, 60],
  [91, 96],
  [98, 100],
];

/**
 * A take before and after one-click edit: the raw recording with the parts
 * the edit kept marked on it, and the finished cut underneath at its real
 * share of the length. The numbers are from one real recording.
 */
export default function TakeCutVisual() {
  return (
    <div className={styles.take}>
      <div className={styles.takeRow}>
        <span>Your take</span>
        <b>6:26</b>
      </div>
      <div className={styles.takeTrack}>
        {kept.map(([from, to]) => (
          <i key={from} style={{ left: `${from}%`, width: `${to - from}%` }} />
        ))}
      </div>
      <div className={styles.takeRow}>
        <span>After one click</span>
        <b>0:45</b>
      </div>
      <div className={styles.takeTrack}>
        <i style={{ left: 0, width: "12%" }} />
      </div>
      <p className={styles.takeNote}>
        Retakes, pauses and silence removed. Captions added.
      </p>
    </div>
  );
}
