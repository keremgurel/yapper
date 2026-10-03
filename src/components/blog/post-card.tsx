import Link from "next/link";
import type { BlogPostMeta } from "@/lib/blog";
import { categoryTone } from "./category-tone";
import styles from "./blog.module.css";

/** One guide as a pastel card: its category, title, a short excerpt and how
 * long it takes to read. The whole card is the link. */
export default function PostCard({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`${styles.card} ${styles.tone}`}
      data-tone={categoryTone(post.category)}
    >
      <span className={styles.chip}>{post.category}</span>
      <h3>{post.title}</h3>
      <p>{post.excerpt}</p>
      <span className={styles.meta}>
        <span>{post.readingTimeText}</span>
      </span>
    </Link>
  );
}
