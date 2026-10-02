import Link from "next/link";
import { fluencyProtocol } from "@/data/training";
import styles from "./bento.module.css";

/** "4 min 30 sec" → 270 */
function toSeconds(duration: string) {
  const minutes = /(\d+)\s*min/.exec(duration)?.[1] ?? 0;
  const seconds = /(\d+)\s*sec/.exec(duration)?.[1] ?? 0;
  return Number(minutes) * 60 + Number(seconds);
}

/**
 * The guided warm-up as a wide card: its drills laid out on one bar, each as
 * wide as the time it takes.
 */
export default function WarmupCard() {
  return (
    <li className={`${styles.card} ${styles.warmup}`}>
      <Link href="/training/fluency-on-steroids">
        <div>
          <h3>12-minute warm-up</h3>
          <p>
            A guided routine for before a meeting or a recording. Four drills,
            one after the other, with the timer running for you.
          </p>
        </div>
        <ol className={styles.routine}>
          {fluencyProtocol.drills.map((drill) => (
            <li
              key={drill.title}
              style={{ flexGrow: toSeconds(drill.duration) }}
            >
              <i aria-hidden="true" />
              <span>{drill.title}</span>
              <small>{drill.duration}</small>
            </li>
          ))}
        </ol>
      </Link>
    </li>
  );
}
