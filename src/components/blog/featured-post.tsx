import Link from "next/link";
import type { BlogPostMeta } from "@/lib/blog";
import { formatBlogDate } from "@/lib/blog-format";
import { categoryTone } from "./category-tone";
import styles from "./blog.module.css";

/** The guide to read first, given the width of the page. */
export default function FeaturedPost({ post }: { post: BlogPostMeta }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`${styles.featured} ${styles.tone}`}
      data-tone={categoryTone(post.category)}
    >
      <div>
        <span className={styles.chip}>Start here</span>
        <h2>{post.title}</h2>
      </div>
      <div>
        <p>{post.excerpt}</p>
        <span className={styles.meta}>
          <span>{post.category}</span>
          <span>{formatBlogDate(post.publishedAt)}</span>
          <span>{post.readingTimeText}</span>
        </span>
      </div>
    </Link>
  );
}
