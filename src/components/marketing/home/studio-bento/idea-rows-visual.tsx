import styles from "./studio-bento.module.css";

const hooks = [
  "I waited three weeks to post. It cost me a month.",
  "The camera was never the problem.",
];

/** A thought typed into Ideas, and the hooks written back from it. */
export default function IdeaRowsVisual() {
  return (
    <div className={styles.idea}>
      <p className={styles.thought}>
        why I stopped waiting for a better camera
        <span className={styles.caret} />
      </p>
      <p className={styles.ideaLabel}>Hooks in your voice</p>
      <ul className={styles.hooks}>
        {hooks.map((hook) => (
          <li key={hook}>{hook}</li>
        ))}
      </ul>
    </div>
  );
}
