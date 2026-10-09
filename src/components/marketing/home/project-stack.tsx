import Link from "next/link";
import { FileText, Lightbulb, Clapperboard } from "lucide-react";
import styles from "./project-stack.module.css";

/** A compact project illustration; the main feature sections remain open. */
export default function ProjectStack() {
  return (
    <section className="marketing-section marketing-rule">
      <div className={`marketing-container marketing-split ${styles.split}`}>
        <div>
          <p className="type-label mb-4">The content library</p>
          <h2 className="type-h2">One idea. Everything that comes next.</h2>
          <p className="type-description">
            The thought in your notes, the script you made your own, the take
            worth keeping. Keep them together, with a content calendar that
            follows the video from first idea to finished post.
          </p>
          <Link
            className="marketing-text-link mt-7"
            href="/features/content-library"
          >
            Explore your content library
          </Link>
          <div className="mt-4">
            <Link
              className="marketing-text-link"
              href="/features/content-calendar"
            >
              Plan your next videos
            </Link>
          </div>
        </div>
        <div className={styles.stack} aria-hidden="true">
          <div className={`${styles.card} ${styles.idea}`}>
            <div className={styles.label}>
              <Lightbulb size={17} /> The idea
            </div>
            <p>What changed when I stopped scripting every word?</p>
          </div>
          <div className={`${styles.card} ${styles.script}`}>
            <div className={styles.label}>
              <FileText size={17} /> The script
            </div>
            <p>Three talking points. Room to be yourself.</p>
          </div>
          <div className={`${styles.card} ${styles.video}`}>
            <div className={styles.label}>
              <Clapperboard size={17} /> The video
            </div>
            <div className={styles.frame}>
              <span className={styles.play}>▶</span>
              <p>
                Less memorizing.
                <br />
                More me.
              </p>
              <span className={styles.duration}>00:45</span>
            </div>
            <div className={styles.footer}>
              <span>Ready to share</span>
              <span>Example project</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
