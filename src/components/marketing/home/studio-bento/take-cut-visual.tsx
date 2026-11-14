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
 * One-click edit on one real recording: the transcript with a retake and a
 * pause struck out, the take's waveform with the kept parts lit, and what the
 * edit did to its length.
 */
export default function TakeCutVisual() {
  return (
    <div className={styles.edit}>
      <div className={styles.editTop}>
        <p className={styles.transcript}>
          <s>I spent weeks choosing, uh, I spent</s> <i>1.4s</i> I spent weeks
          choosing a camera before I made my first video. <s>Every review</s>{" "}
          <i>0.9s</i> Every review gave me another reason to wait.
        </p>
        <dl className={styles.result}>
          <div>
            <dt>Recorded</dt>
            <dd>6:26</dd>
          </div>
          <div>
            <dt>After one click</dt>
            <dd>0:45</dd>
          </div>
        </dl>
      </div>
      <div className={styles.wave}>
        {kept.map(([from, to]) => (
          <span
            key={from}
            style={{ left: `${from}%`, width: `${to - from}%` }}
          />
        ))}
      </div>
      <p className={styles.waveNote}>
        The lit parts are what one click kept of this take.
      </p>
    </div>
  );
}
