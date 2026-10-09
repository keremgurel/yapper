"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./feature-stack.module.css";

/** Keeps tall previews fully scrollable before the next card covers them. */
export default function FeatureStack({ children }: { children: ReactNode }) {
  const stack = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = Array.from(stack.current?.children ?? []);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target instanceof HTMLElement) {
          entry.target.style.setProperty(
            "--card-height",
            `${entry.target.offsetHeight}px`,
          );
        }
      }
    });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={stack} className={styles.stack}>
      {children}
    </div>
  );
}
