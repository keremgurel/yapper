"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import styles from "./rail.module.css";

export interface RailGuide {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readingTimeText: string;
}

/** A sideways-scrolling shelf of guides. Scroll, swipe, or use the arrows. */
export default function GuidesRail({ guides }: { guides: RailGuide[] }) {
  const rail = useRef<HTMLUListElement>(null);
  const scroll = (direction: 1 | -1) =>
    rail.current?.scrollBy({
      left: direction * rail.current.clientWidth * 0.8,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  return (
    <section className="marketing-section marketing-rule">
      <div className="marketing-container">
        <div className={styles.heading}>
          <div>
            <h2 className="type-h2">Guides for getting better at speaking</h2>
            <p className="type-description">
              Practical routines you can do alone, with topics and drills to use
              straight away.
            </p>
          </div>
          <div className={styles.arrows}>
            <button
              type="button"
              aria-label="Previous guides"
              onClick={() => scroll(-1)}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="More guides"
              onClick={() => scroll(1)}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
      <ul ref={rail} className={styles.rail} tabIndex={0} aria-label="Guides">
        {guides.map((guide, index) => (
          <li key={guide.slug} data-tone={index % 3}>
            <Link href={`/blog/${guide.slug}`}>
              <span className={styles.category}>{guide.category}</span>
              <h3>{guide.title}</h3>
              <p>{guide.excerpt}</p>
              <span className={styles.time}>{guide.readingTimeText}</span>
            </Link>
          </li>
        ))}
        <li className={styles.all}>
          <Link href="/blog">
            <h3>All speaking guides</h3>
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </li>
      </ul>
    </section>
  );
}
