import type { BlogHeading } from "@/lib/blog";
import styles from "./article.module.css";

/** The article's sections, beside the text on wide screens. */
export default function PostToc({ headings }: { headings: BlogHeading[] }) {
  if (headings.length < 2) return null;
  return (
    <nav className={styles.toc} aria-label="On this page">
      <p>On this page</p>
      <ol>
        {headings.map((heading) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`} data-level={heading.level}>
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
