import CreatorFrame from "./creator-frame";
import styles from "./studio-bento.module.css";

/** The teleprompter while recording: the script over the camera picture. */
export default function PrompterVisual() {
  return (
    <CreatorFrame shape="landscape" dimmed>
      <div className={styles.prompter}>
        <p>I spent weeks choosing a camera</p>
        <p className={styles.prompterNow}>before I made my first video.</p>
        <p>Every review gave me another</p>
      </div>
      <span className={styles.recording}>
        <i />
        0:12
      </span>
    </CreatorFrame>
  );
}
