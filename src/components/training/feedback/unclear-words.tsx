import type { UnclearWord } from "@/lib/pronunciation/types";
import styles from "@/components/training/feedback/pronunciation.module.css";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** The words that came out least clearly, each with how clear it was and when
 * it was said, so it can be found in the recording and practiced. */
export default function UnclearWords({ words }: { words: UnclearWord[] }) {
  return (
    <div>
      <h4 className={styles.wordsHeading}>Words to say again</h4>
      <ul className={styles.words}>
        {words.map((word) => (
          <li key={word.text} className={styles.word}>
            <p className={styles.wordText}>{word.text}</p>
            <span className={styles.wordBar} aria-hidden="true">
              <i style={{ width: `${word.accuracy}%` }} />
            </span>
            <p className={styles.wordMeta}>
              <span>{word.accuracy} out of 100</span>
              <span>at {clock(word.start)}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
