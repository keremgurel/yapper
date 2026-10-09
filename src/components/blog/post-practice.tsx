import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./article.module.css";

/** The step after reading: try it out loud, on the same pastel field the
 * product demos use. */
export default function PostPractice() {
  return (
    <aside className={`demo-field ${styles.practice}`}>
      <div>
        <h2>Try it out loud</h2>
        <p>
          Pull a random topic, set a minute, and use one idea from this guide.
        </p>
      </div>
      <Button asChild>
        <Link href="https://speakingpractice.ai/">Get a topic</Link>
      </Button>
    </aside>
  );
}
