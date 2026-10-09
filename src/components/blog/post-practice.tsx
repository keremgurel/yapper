import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./article.module.css";

/** The step after reading: try it out loud, on the same pastel field the
 * product demos use. */
export default function PostPractice({
  creator = false,
}: {
  creator?: boolean;
}) {
  return (
    <aside className={`demo-field ${styles.practice}`}>
      <div>
        <h2>{creator ? "Turn your idea into a video" : "Try it out loud"}</h2>
        <p>
          {creator
            ? "Bring your idea, script and recording together in Yapper Studio."
            : "Pull a random topic, set a minute, and use one idea from this guide."}
        </p>
      </div>
      <Button asChild>
        <Link
          href={
            creator
              ? "/features/idea-capture"
              : "/training/random-topic-generator"
          }
        >
          {creator ? "Explore Studio ideas" : "Get a topic"}
        </Link>
      </Button>
    </aside>
  );
}
