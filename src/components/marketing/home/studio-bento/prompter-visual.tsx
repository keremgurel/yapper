import styles from "./studio-bento.module.css";

/** A script on the teleprompter, with the line being read in full ink. */
export default function PrompterVisual() {
  return (
    <div className={styles.prompter}>
      <p>I spent weeks choosing a camera</p>
      <p className={styles.prompterNow}>before I made my first video.</p>
      <p>Every review gave me another</p>
      <span className={styles.prompterSpeed}>240 words a minute</span>
    </div>
  );
}
