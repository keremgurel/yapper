import type { UpgradeLine } from "@/lib/training-feedback/types";
import { diffRewrite } from "@/components/training/feedback/phrase-diff";
import styles from "@/components/training/feedback/rewrites.module.css";

/**
 * Lines worth re-saying. Each card puts what was said above the stronger
 * version, with the words that changed marked, so the difference is visible
 * without reading both lines twice.
 */
/** Past this share of new words the line is a fresh sentence, and marking
 * nearly all of it would say nothing. */
const MOSTLY_NEW = 0.5;

function Rewrite({ line }: { line: UpgradeLine }) {
  const tokens = diffRewrite(line.before, line.after);
  const changed = tokens.filter((token) => token.changed).length;
  if (tokens.length === 0 || changed / tokens.length > MOSTLY_NEW)
    return <p>{line.after}</p>;
  return (
    <p>
      {tokens.map((token, i) => (
        <span key={i}>
          {token.changed ? <mark>{token.text}</mark> : token.text}{" "}
        </span>
      ))}
    </p>
  );
}

export default function UpgradeLines({ lines }: { lines: UpgradeLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className={styles.rewrites}>
      {lines.map((line, index) => (
        <li key={index} className={styles.rewrite}>
          <div className={styles.said}>
            <p className={styles.tag}>You said</p>
            <p>{line.before}</p>
          </div>
          <div className={styles.better}>
            <p className={styles.tag}>Say it like this</p>
            <Rewrite line={line} />
          </div>
        </li>
      ))}
    </ul>
  );
}
