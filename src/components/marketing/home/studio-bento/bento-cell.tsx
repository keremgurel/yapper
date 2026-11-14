import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./studio-bento.module.css";

/**
 * One cell of the homepage bento: a small picture of the product, what it
 * does, and a link to the page that explains it. The whole cell is the link.
 */
export default function BentoCell({
  href,
  title,
  body,
  linkLabel,
  wide = false,
  children,
}: {
  href: string;
  title: string;
  body: string;
  linkLabel: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <article className={`${styles.cell} ${wide ? styles.wide : ""}`}>
      <div className={styles.visual} aria-hidden="true">
        {children}
      </div>
      <div className={styles.copy}>
        <h3>{title}</h3>
        <p>{body}</p>
        <Link href={href} className={styles.link}>
          {linkLabel}
        </Link>
      </div>
    </article>
  );
}
